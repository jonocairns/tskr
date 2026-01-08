-- Migration: Move passwordResetRequired and passwordLoginDisabled from User to Account
-- Also removes passwordHash from User (Better Auth stores passwords in Account.password)

-- Step 1: Add new columns to Account table
ALTER TABLE "Account" ADD COLUMN "passwordResetRequired" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "Account" ADD COLUMN "disabled" BOOLEAN NOT NULL DEFAULT false;

-- Step 2: Migrate data from User to credential Accounts
UPDATE "Account"
SET
  "passwordResetRequired" = (SELECT "passwordResetRequired" FROM "User" WHERE "User"."id" = "Account"."userId"),
  "disabled" = (SELECT "passwordLoginDisabled" FROM "User" WHERE "User"."id" = "Account"."userId")
WHERE "providerId" = 'credential';

-- Step 3: Create new User table without the old columns
CREATE TABLE "new_User" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT,
    "email" TEXT,
    "emailVerified" BOOLEAN NOT NULL DEFAULT false,
    "image" TEXT,
    "isSuperAdmin" BOOLEAN NOT NULL DEFAULT false,
    "lastHouseholdId" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "User_lastHouseholdId_fkey" FOREIGN KEY ("lastHouseholdId") REFERENCES "Household" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- Step 4: Copy data to new User table (excluding passwordHash, passwordResetRequired, passwordLoginDisabled)
INSERT INTO "new_User" ("id", "name", "email", "emailVerified", "image", "isSuperAdmin", "lastHouseholdId", "createdAt", "updatedAt")
SELECT "id", "name", "email", "emailVerified", "image", "isSuperAdmin", "lastHouseholdId", "createdAt", "updatedAt" FROM "User";

-- Step 5: Drop old table and rename new one
PRAGMA foreign_keys=OFF;
DROP TABLE "User";
ALTER TABLE "new_User" RENAME TO "User";
PRAGMA foreign_keys=ON;

-- Step 6: Recreate indexes
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");
