-- CreateTable
CREATE TABLE "AssignedTask" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "householdId" TEXT NOT NULL,
    "presetId" TEXT NOT NULL,
    "assignedToId" TEXT NOT NULL,
    "assignedById" TEXT NOT NULL,
    "assignedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "status" TEXT NOT NULL DEFAULT 'ACTIVE',
    "cadenceTarget" INTEGER NOT NULL,
    "cadenceIntervalMinutes" INTEGER NOT NULL,
    "isRecurring" BOOLEAN NOT NULL DEFAULT false,
    CONSTRAINT "AssignedTask_householdId_fkey" FOREIGN KEY ("householdId") REFERENCES "Household" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "AssignedTask_presetId_fkey" FOREIGN KEY ("presetId") REFERENCES "PresetTask" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "AssignedTask_assignedToId_fkey" FOREIGN KEY ("assignedToId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "AssignedTask_assignedById_fkey" FOREIGN KEY ("assignedById") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

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
    "assignedTaskId" TEXT,
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
    CONSTRAINT "PointLog_assignedTaskId_fkey" FOREIGN KEY ("assignedTaskId") REFERENCES "AssignedTask" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "PointLog_approvedById_fkey" FOREIGN KEY ("approvedById") REFERENCES "User" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "PointLog_rejectedById_fkey" FOREIGN KEY ("rejectedById") REFERENCES "User" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "PointLog_revertedById_fkey" FOREIGN KEY ("revertedById") REFERENCES "User" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
INSERT INTO "new_PointLog" (
    "createdAt",
    "description",
    "duration",
    "durationMinutes",
    "id",
    "kind",
    "points",
    "presetId",
    "presetKey",
    "rewardCost",
    "status",
    "approvedById",
    "approvedAt",
    "rejectedById",
    "rejectedAt",
    "revertedAt",
    "revertedById",
    "updatedAt",
    "userId",
    "householdId"
)
SELECT
    "createdAt",
    "description",
    "duration",
    "durationMinutes",
    "id",
    "kind",
    "points",
    "presetId",
    "presetKey",
    "rewardCost",
    "status",
    "approvedById",
    "approvedAt",
    "rejectedById",
    "rejectedAt",
    "revertedAt",
    "revertedById",
    "updatedAt",
    "userId",
    "householdId"
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
CREATE INDEX "PointLog_assignedTaskId_idx" ON "PointLog"("assignedTaskId");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;

-- CreateIndex
CREATE INDEX "AssignedTask_householdId_idx" ON "AssignedTask"("householdId");
CREATE INDEX "AssignedTask_assignedToId_idx" ON "AssignedTask"("assignedToId");
CREATE INDEX "AssignedTask_presetId_idx" ON "AssignedTask"("presetId");
CREATE INDEX "AssignedTask_status_idx" ON "AssignedTask"("status");
