-- Replace hardcoded 'default-household' ID with a generated ID
-- This migration updates the household ID and all foreign key references
--
-- WARNING: This is a ONE-WAY migration. The original 'default-household' ID
-- cannot be recovered after this migration runs. Rollback is not possible.

-- First, store the new ID in a temporary table
CREATE TEMPORARY TABLE "_new_household_id" (
    "oldId" TEXT NOT NULL,
    "newId" TEXT NOT NULL
);

INSERT INTO "_new_household_id" ("oldId", "newId")
SELECT 'default-household', lower(hex(randomblob(16)))
WHERE EXISTS (SELECT 1 FROM "Household" WHERE "id" = 'default-household');

-- Create the new Household row first so FK updates are valid
INSERT INTO "Household" ("id", "name", "rewardThreshold", "progressBarColor", "createdById", "createdAt", "updatedAt")
SELECT n."newId", h."name", h."rewardThreshold", h."progressBarColor", h."createdById", h."createdAt", h."updatedAt"
FROM "Household" h
JOIN "_new_household_id" n ON n."oldId" = h."id";

-- Update all foreign key references
UPDATE "HouseholdMember"
SET "householdId" = (SELECT "newId" FROM "_new_household_id" WHERE "oldId" = 'default-household')
WHERE "householdId" = 'default-household';

UPDATE "HouseholdInvite"
SET "householdId" = (SELECT "newId" FROM "_new_household_id" WHERE "oldId" = 'default-household')
WHERE "householdId" = 'default-household';

UPDATE "User"
SET "lastHouseholdId" = (SELECT "newId" FROM "_new_household_id" WHERE "oldId" = 'default-household')
WHERE "lastHouseholdId" = 'default-household';

UPDATE "PointLog"
SET "householdId" = (SELECT "newId" FROM "_new_household_id" WHERE "oldId" = 'default-household')
WHERE "householdId" = 'default-household';

UPDATE "PresetTask"
SET "householdId" = (SELECT "newId" FROM "_new_household_id" WHERE "oldId" = 'default-household')
WHERE "householdId" = 'default-household';

UPDATE "AssignedTask"
SET "householdId" = (SELECT "newId" FROM "_new_household_id" WHERE "oldId" = 'default-household')
WHERE "householdId" = 'default-household';

-- Finally, remove the old Household row
DELETE FROM "Household"
WHERE "id" = 'default-household';

-- Clean up temporary table
DROP TABLE "_new_household_id";
