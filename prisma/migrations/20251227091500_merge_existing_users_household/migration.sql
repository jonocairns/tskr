-- If households are brand new (no members yet), create one shared household
-- and add every existing user as a DICTATOR.
INSERT INTO "Household" ("id", "name", "createdById", "createdAt", "updatedAt")
SELECT
	'default-household',
	'Household',
	u."id",
	CURRENT_TIMESTAMP,
	CURRENT_TIMESTAMP
FROM "User" u
WHERE NOT EXISTS (SELECT 1 FROM "Household")
ORDER BY u."createdAt" ASC
LIMIT 1;

INSERT OR IGNORE INTO "HouseholdMember" (
	"id",
	"householdId",
	"userId",
	"role",
	"requiresApprovalDefault",
	"joinedAt"
)
SELECT
	lower(hex(randomblob(16))),
	(SELECT "id" FROM "Household" ORDER BY "createdAt" ASC LIMIT 1),
	u."id",
	'DICTATOR',
	0,
	CURRENT_TIMESTAMP
FROM "User" u
WHERE NOT EXISTS (SELECT 1 FROM "HouseholdMember");

UPDATE "User"
SET "lastHouseholdId" = (
	SELECT "id" FROM "Household" ORDER BY "createdAt" ASC LIMIT 1
)
WHERE "lastHouseholdId" IS NULL
	AND EXISTS (SELECT 1 FROM "HouseholdMember");
