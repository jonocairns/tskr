WITH "VisiblePresets" AS (
	SELECT
		"HouseholdMember"."householdId" AS "householdId",
		"HouseholdMember"."userId" AS "userId",
		"PresetTask"."id" AS "presetId",
		"PresetTask"."createdAt" AS "presetCreatedAt"
	FROM "HouseholdMember"
	INNER JOIN "PresetTask"
		ON "PresetTask"."householdId" = "HouseholdMember"."householdId"
	WHERE "PresetTask"."isShared" = 1 OR "PresetTask"."createdById" = "HouseholdMember"."userId"
),
"MissingVisiblePresets" AS (
	SELECT
		"VisiblePresets"."householdId",
		"VisiblePresets"."userId",
		"VisiblePresets"."presetId",
		"VisiblePresets"."presetCreatedAt"
	FROM "VisiblePresets"
	LEFT JOIN "PresetTaskOrder"
		ON "PresetTaskOrder"."householdId" = "VisiblePresets"."householdId"
		AND "PresetTaskOrder"."userId" = "VisiblePresets"."userId"
		AND "PresetTaskOrder"."presetId" = "VisiblePresets"."presetId"
	WHERE "PresetTaskOrder"."presetId" IS NULL
),
"UserOrderBaselines" AS (
	SELECT
		"MissingVisiblePresets"."householdId",
		"MissingVisiblePresets"."userId",
		COALESCE(MAX("PresetTaskOrder"."sortOrder"), -1) AS "maxSortOrder"
	FROM "MissingVisiblePresets"
	LEFT JOIN "PresetTaskOrder"
		ON "PresetTaskOrder"."householdId" = "MissingVisiblePresets"."householdId"
		AND "PresetTaskOrder"."userId" = "MissingVisiblePresets"."userId"
	GROUP BY "MissingVisiblePresets"."householdId", "MissingVisiblePresets"."userId"
),
"RankedMissingVisiblePresets" AS (
	SELECT
		"MissingVisiblePresets"."householdId",
		"MissingVisiblePresets"."userId",
		"MissingVisiblePresets"."presetId",
		"UserOrderBaselines"."maxSortOrder"
		+ ROW_NUMBER() OVER (
			PARTITION BY "MissingVisiblePresets"."householdId", "MissingVisiblePresets"."userId"
			ORDER BY "MissingVisiblePresets"."presetCreatedAt" ASC, "MissingVisiblePresets"."presetId" ASC
		) AS "sortOrder"
	FROM "MissingVisiblePresets"
	INNER JOIN "UserOrderBaselines"
		ON "UserOrderBaselines"."householdId" = "MissingVisiblePresets"."householdId"
		AND "UserOrderBaselines"."userId" = "MissingVisiblePresets"."userId"
)
INSERT INTO "PresetTaskOrder" ("householdId", "userId", "presetId", "sortOrder")
SELECT "householdId", "userId", "presetId", "sortOrder"
FROM "RankedMissingVisiblePresets";
