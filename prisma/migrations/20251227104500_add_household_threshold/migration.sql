-- CreateTable
CREATE TABLE "Household" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "rewardThreshold" INTEGER NOT NULL DEFAULT 50,
    "createdById" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "Household_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "HouseholdMember" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "householdId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "role" TEXT NOT NULL DEFAULT 'DOER',
    "requiresApprovalDefault" BOOLEAN NOT NULL DEFAULT false,
    "joinedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "HouseholdMember_householdId_fkey" FOREIGN KEY ("householdId") REFERENCES "Household" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "HouseholdMember_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "HouseholdInvite" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "householdId" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "role" TEXT NOT NULL DEFAULT 'DOER',
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "invitedById" TEXT NOT NULL,
    "invitedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expiresAt" DATETIME NOT NULL,
    "respondedAt" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "HouseholdInvite_householdId_fkey" FOREIGN KEY ("householdId") REFERENCES "Household" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "HouseholdInvite_invitedById_fkey" FOREIGN KEY ("invitedById") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- Seed a shared household for existing users
INSERT INTO "Household" ("id", "name", "rewardThreshold", "createdById", "createdAt", "updatedAt")
SELECT
    'default-household',
    'Household',
    50,
    u."id",
    CURRENT_TIMESTAMP,
    CURRENT_TIMESTAMP
FROM "User" u
ORDER BY u."createdAt" ASC
LIMIT 1;

INSERT INTO "HouseholdMember" ("id", "householdId", "userId", "role", "requiresApprovalDefault", "joinedAt")
SELECT
    lower(hex(randomblob(16))),
    (SELECT "id" FROM "Household" ORDER BY "createdAt" ASC LIMIT 1),
    u."id",
    'DICTATOR',
    0,
    CURRENT_TIMESTAMP
FROM "User" u
WHERE EXISTS (SELECT 1 FROM "Household");

-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_PointLog" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "householdId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "kind" TEXT NOT NULL DEFAULT 'PRESET',
    "duration" TEXT,
    "points" INTEGER NOT NULL,
    "description" TEXT NOT NULL,
    "presetKey" TEXT,
    "presetId" TEXT,
    "durationMinutes" INTEGER,
    "rewardCost" INTEGER,
    "status" TEXT NOT NULL DEFAULT 'APPROVED',
    "approvedById" TEXT,
    "approvedAt" DATETIME,
    "rejectedById" TEXT,
    "rejectedAt" DATETIME,
    "revertedAt" DATETIME,
    "revertedById" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "PointLog_householdId_fkey" FOREIGN KEY ("householdId") REFERENCES "Household" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "PointLog_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "PointLog_presetId_fkey" FOREIGN KEY ("presetId") REFERENCES "PresetTask" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "PointLog_approvedById_fkey" FOREIGN KEY ("approvedById") REFERENCES "User" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "PointLog_rejectedById_fkey" FOREIGN KEY ("rejectedById") REFERENCES "User" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "PointLog_revertedById_fkey" FOREIGN KEY ("revertedById") REFERENCES "User" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
INSERT INTO "new_PointLog" ("createdAt", "description", "duration", "durationMinutes", "id", "kind", "points", "presetId", "presetKey", "revertedAt", "revertedById", "rewardCost", "updatedAt", "userId", "householdId", "status", "approvedById", "approvedAt", "rejectedById", "rejectedAt")
SELECT
    "PointLog"."createdAt",
    "PointLog"."description",
    "PointLog"."duration",
    "PointLog"."durationMinutes",
    "PointLog"."id",
    "PointLog"."kind",
    "PointLog"."points",
    "PointLog"."presetId",
    "PointLog"."presetKey",
    "PointLog"."revertedAt",
    "PointLog"."revertedById",
    "PointLog"."rewardCost",
    "PointLog"."updatedAt",
    "PointLog"."userId",
    (SELECT "id" FROM "Household" ORDER BY "createdAt" ASC LIMIT 1),
    'APPROVED',
    NULL,
    NULL,
    NULL,
    NULL
FROM "PointLog";
DROP TABLE "PointLog";
ALTER TABLE "new_PointLog" RENAME TO "PointLog";
CREATE INDEX "PointLog_householdId_idx" ON "PointLog"("householdId");
CREATE INDEX "PointLog_householdId_status_idx" ON "PointLog"("householdId", "status");
CREATE INDEX "PointLog_userId_idx" ON "PointLog"("userId");
CREATE INDEX "PointLog_kind_idx" ON "PointLog"("kind");
CREATE INDEX "PointLog_revertedAt_idx" ON "PointLog"("revertedAt");
CREATE INDEX "PointLog_createdAt_idx" ON "PointLog"("createdAt");
CREATE INDEX "PointLog_userId_revertedAt_idx" ON "PointLog"("userId", "revertedAt");
CREATE INDEX "PointLog_presetId_idx" ON "PointLog"("presetId");
CREATE TABLE "new_PresetTask" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "householdId" TEXT NOT NULL,
    "createdById" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "bucket" TEXT NOT NULL,
    "isShared" BOOLEAN NOT NULL DEFAULT false,
    "approvalOverride" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "PresetTask_householdId_fkey" FOREIGN KEY ("householdId") REFERENCES "Household" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "PresetTask_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
INSERT INTO "new_PresetTask" ("bucket", "createdAt", "createdById", "id", "isShared", "label", "updatedAt", "householdId", "approvalOverride")
SELECT
    "PresetTask"."bucket",
    "PresetTask"."createdAt",
    "PresetTask"."createdById",
    "PresetTask"."id",
    "PresetTask"."isShared",
    "PresetTask"."label",
    "PresetTask"."updatedAt",
    (SELECT "id" FROM "Household" ORDER BY "createdAt" ASC LIMIT 1),
    NULL
FROM "PresetTask";
DROP TABLE "PresetTask";
ALTER TABLE "new_PresetTask" RENAME TO "PresetTask";
CREATE INDEX "PresetTask_householdId_idx" ON "PresetTask"("householdId");
CREATE INDEX "PresetTask_createdById_idx" ON "PresetTask"("createdById");
CREATE INDEX "PresetTask_isShared_idx" ON "PresetTask"("isShared");
CREATE INDEX "PresetTask_bucket_idx" ON "PresetTask"("bucket");
CREATE TABLE "new_User" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT,
    "email" TEXT,
    "emailVerified" DATETIME,
    "image" TEXT,
    "lastHouseholdId" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "User_lastHouseholdId_fkey" FOREIGN KEY ("lastHouseholdId") REFERENCES "Household" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
INSERT INTO "new_User" ("createdAt", "email", "emailVerified", "id", "image", "name", "updatedAt", "lastHouseholdId")
SELECT
    "User"."createdAt",
    "User"."email",
    "User"."emailVerified",
    "User"."id",
    "User"."image",
    "User"."name",
    "User"."updatedAt",
    (SELECT "id" FROM "Household" ORDER BY "createdAt" ASC LIMIT 1)
FROM "User";
DROP TABLE "User";
ALTER TABLE "new_User" RENAME TO "User";
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;

-- CreateIndex
CREATE INDEX "Household_createdById_idx" ON "Household"("createdById");

-- CreateIndex
CREATE INDEX "HouseholdMember_householdId_idx" ON "HouseholdMember"("householdId");

-- CreateIndex
CREATE INDEX "HouseholdMember_userId_idx" ON "HouseholdMember"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "HouseholdMember_householdId_userId_key" ON "HouseholdMember"("householdId", "userId");

-- CreateIndex
CREATE UNIQUE INDEX "HouseholdInvite_code_key" ON "HouseholdInvite"("code");

-- CreateIndex
CREATE INDEX "HouseholdInvite_householdId_idx" ON "HouseholdInvite"("householdId");

-- CreateIndex
CREATE INDEX "HouseholdInvite_status_idx" ON "HouseholdInvite"("status");
