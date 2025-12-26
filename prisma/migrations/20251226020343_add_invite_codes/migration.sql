/*
  Warnings:

  - You are about to drop the column `email` on the `HouseholdInvite` table. All the data in the column will be lost.
  - Added the required column `code` to the `HouseholdInvite` table without a default value. This is not possible if the table is not empty.

*/
-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_HouseholdInvite" (
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
INSERT INTO "new_HouseholdInvite" ("createdAt", "expiresAt", "householdId", "id", "invitedAt", "invitedById", "respondedAt", "role", "status", "updatedAt", "code")
SELECT
    "createdAt",
    "expiresAt",
    "householdId",
    "id",
    "invitedAt",
    "invitedById",
    "respondedAt",
    "role",
    "status",
    "updatedAt",
    upper(hex(randomblob(4)))
FROM "HouseholdInvite";
DROP TABLE "HouseholdInvite";
ALTER TABLE "new_HouseholdInvite" RENAME TO "HouseholdInvite";
CREATE UNIQUE INDEX "HouseholdInvite_code_key" ON "HouseholdInvite"("code");
CREATE INDEX "HouseholdInvite_householdId_idx" ON "HouseholdInvite"("householdId");
CREATE INDEX "HouseholdInvite_status_idx" ON "HouseholdInvite"("status");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
