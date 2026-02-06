-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_Household" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "timeZone" TEXT NOT NULL DEFAULT 'Pacific/Auckland',
    "rewardThreshold" INTEGER NOT NULL DEFAULT 50,
    "progressBarColor" TEXT,
    "createdById" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "Household_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
INSERT INTO "new_Household" ("createdAt", "createdById", "id", "name", "progressBarColor", "rewardThreshold", "updatedAt") SELECT "createdAt", "createdById", "id", "name", "progressBarColor", "rewardThreshold", "updatedAt" FROM "Household";
DROP TABLE "Household";
ALTER TABLE "new_Household" RENAME TO "Household";
CREATE INDEX "Household_createdById_idx" ON "Household"("createdById");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
