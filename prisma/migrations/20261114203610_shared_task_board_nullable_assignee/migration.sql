-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_AssignedTask" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "householdId" TEXT NOT NULL,
    "presetId" TEXT NOT NULL,
    "assignedToId" TEXT,
    "assignedById" TEXT,
    "assignedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "status" TEXT NOT NULL DEFAULT 'ACTIVE',
    "cadenceTarget" INTEGER NOT NULL,
    "cadenceIntervalMinutes" INTEGER NOT NULL,
    "isRecurring" BOOLEAN NOT NULL DEFAULT false,
    CONSTRAINT "AssignedTask_householdId_fkey" FOREIGN KEY ("householdId") REFERENCES "Household" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "AssignedTask_presetId_fkey" FOREIGN KEY ("presetId") REFERENCES "PresetTask" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "AssignedTask_assignedToId_fkey" FOREIGN KEY ("assignedToId") REFERENCES "User" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "AssignedTask_assignedById_fkey" FOREIGN KEY ("assignedById") REFERENCES "User" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
INSERT INTO "new_AssignedTask" ("assignedAt", "assignedById", "assignedToId", "cadenceIntervalMinutes", "cadenceTarget", "householdId", "id", "isRecurring", "presetId", "status") SELECT "assignedAt", "assignedById", "assignedToId", "cadenceIntervalMinutes", "cadenceTarget", "householdId", "id", "isRecurring", "presetId", "status" FROM "AssignedTask";
DROP TABLE "AssignedTask";
ALTER TABLE "new_AssignedTask" RENAME TO "AssignedTask";
CREATE INDEX "AssignedTask_householdId_idx" ON "AssignedTask"("householdId");
CREATE INDEX "AssignedTask_assignedToId_idx" ON "AssignedTask"("assignedToId");
CREATE INDEX "AssignedTask_presetId_idx" ON "AssignedTask"("presetId");
CREATE INDEX "AssignedTask_status_idx" ON "AssignedTask"("status");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
