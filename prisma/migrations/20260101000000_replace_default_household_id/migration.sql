-- Replace hardcoded 'default-household' ID with a generated ID
-- This migration updates the household ID and all foreign key references

-- First, store the new ID in a temporary table
CREATE TEMPORARY TABLE "_new_household_id" (
    "oldId" TEXT NOT NULL,
    "newId" TEXT NOT NULL
);

INSERT INTO "_new_household_id" ("oldId", "newId")
SELECT 'default-household', lower(hex(randomblob(16)))
WHERE EXISTS (SELECT 1 FROM "Household" WHERE "id" = 'default-household');

-- Update all foreign key references first (before changing the primary key)
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

-- Finally, update the Household primary key
UPDATE "Household"
SET "id" = (SELECT "newId" FROM "_new_household_id" WHERE "oldId" = 'default-household')
WHERE "id" = 'default-household';

-- Clean up temporary table
DROP TABLE "_new_household_id";
