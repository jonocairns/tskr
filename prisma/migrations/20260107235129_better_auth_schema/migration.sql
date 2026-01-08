/*
  Better Auth Schema Migration

  This migration converts NextAuth schema to Better Auth schema.

  IMPORTANT: Users will need to re-login after this migration because:
  - Session tokens change format (sessionToken → token)
  - Session expiry column changes (expires → expiresAt)

  OAuth accounts (Google) are preserved and will continue to work.
  Password accounts are migrated to Better Auth's credential format.
*/

-- DropIndex (VerificationToken is replaced by Verification)
DROP INDEX IF EXISTS "VerificationToken_identifier_token_key";

-- DropTable VerificationToken
PRAGMA foreign_keys=off;
DROP TABLE IF EXISTS "VerificationToken";
PRAGMA foreign_keys=on;

-- CreateTable Verification (Better Auth equivalent)
CREATE TABLE IF NOT EXISTS "Verification" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "identifier" TEXT NOT NULL,
    "value" TEXT NOT NULL,
    "expiresAt" DATETIME NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;

-- Migrate Account table (NextAuth → Better Auth)
-- Column mapping:
--   provider → providerId
--   providerAccountId → accountId
--   access_token → accessToken
--   refresh_token → refreshToken
--   id_token → idToken
--   expires_at → accessTokenExpiresAt (as datetime)
CREATE TABLE "new_Account" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "accountId" TEXT NOT NULL,
    "providerId" TEXT NOT NULL,
    "accessToken" TEXT,
    "refreshToken" TEXT,
    "accessTokenExpiresAt" DATETIME,
    "refreshTokenExpiresAt" DATETIME,
    "scope" TEXT,
    "idToken" TEXT,
    "password" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Account_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- Migrate OAuth accounts with proper column mapping
INSERT INTO "new_Account" (
    "id",
    "userId",
    "accountId",
    "providerId",
    "accessToken",
    "refreshToken",
    "accessTokenExpiresAt",
    "scope",
    "idToken",
    "createdAt",
    "updatedAt"
)
SELECT
    "id",
    "userId",
    "providerAccountId",
    "provider",
    "access_token",
    "refresh_token",
    CASE WHEN "expires_at" IS NOT NULL
         THEN datetime("expires_at", 'unixepoch')
         ELSE NULL
    END,
    "scope",
    "id_token",
    CURRENT_TIMESTAMP,
    CURRENT_TIMESTAMP
FROM "Account"
WHERE "provider" IS NOT NULL AND "providerAccountId" IS NOT NULL;

DROP TABLE "Account";
ALTER TABLE "new_Account" RENAME TO "Account";
CREATE INDEX "Account_userId_idx" ON "Account"("userId");
CREATE UNIQUE INDEX "Account_providerId_accountId_key" ON "Account"("providerId", "accountId");

-- Migrate Session table (NextAuth → Better Auth)
-- Column mapping:
--   sessionToken → token
--   expires → expiresAt
CREATE TABLE "new_Session" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "token" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "expiresAt" DATETIME NOT NULL,
    "ipAddress" TEXT,
    "userAgent" TEXT,
    "lastActivity" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Session_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- Migrate existing sessions (they will still be invalidated because Better Auth
-- uses different session validation, but at least the data structure is correct)
INSERT INTO "new_Session" (
    "id",
    "token",
    "userId",
    "expiresAt",
    "createdAt",
    "updatedAt"
)
SELECT
    "id",
    "sessionToken",
    "userId",
    "expires",
    CURRENT_TIMESTAMP,
    CURRENT_TIMESTAMP
FROM "Session"
WHERE "sessionToken" IS NOT NULL AND "expires" IS NOT NULL;

DROP TABLE "Session";
ALTER TABLE "new_Session" RENAME TO "Session";
CREATE UNIQUE INDEX "Session_token_key" ON "Session"("token");
CREATE INDEX "Session_userId_idx" ON "Session"("userId");
CREATE INDEX "Session_token_idx" ON "Session"("token");

PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;

-- CreateIndex
CREATE INDEX IF NOT EXISTS "Verification_identifier_idx" ON "Verification"("identifier");

-- Create credential accounts for users with password hashes
-- This allows password-based login to continue working
INSERT INTO "Account" ("id", "userId", "accountId", "providerId", "password", "createdAt", "updatedAt")
SELECT
    lower(hex(randomblob(12))),
    "id",
    "id",
    'credential',
    "passwordHash",
    CURRENT_TIMESTAMP,
    CURRENT_TIMESTAMP
FROM "User"
WHERE "passwordHash" IS NOT NULL
  AND "id" NOT IN (
      SELECT "userId" FROM "Account" WHERE "providerId" = 'credential'
  );
