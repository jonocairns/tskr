WITH "VisiblePresets" AS (
	SELECT
		"HouseholdMember"."householdId" AS "householdId",
		"HouseholdMember"."userId" AS "userId",
		"PresetTask"."id" AS "presetId",
		"PresetTask"."createdById" AS "presetCreatedById",
		"PresetTask"."createdAt" AS "presetCreatedAt"
	FROM "HouseholdMember"
	INNER JOIN "PresetTask"
		ON "PresetTask"."householdId" = "HouseholdMember"."householdId"
	WHERE "PresetTask"."isShared" = 1 OR "PresetTask"."createdById" = "HouseholdMember"."userId"
),
"ArtifactUsers" AS (
	SELECT
		"VisiblePresets"."householdId",
		"VisiblePresets"."userId"
	FROM "VisiblePresets"
	LEFT JOIN "PresetTaskOrder"
		ON "PresetTaskOrder"."householdId" = "VisiblePresets"."householdId"
		AND "PresetTaskOrder"."userId" = "VisiblePresets"."userId"
		AND "PresetTaskOrder"."presetId" = "VisiblePresets"."presetId"
	GROUP BY "VisiblePresets"."householdId", "VisiblePresets"."userId"
	HAVING COUNT(*) > 0
		AND COUNT("PresetTaskOrder"."presetId") < COUNT(*)
		AND SUM(
			CASE
				WHEN "PresetTaskOrder"."presetId" IS NOT NULL
					AND "VisiblePresets"."presetCreatedById" <> "VisiblePresets"."userId"
				THEN 1
				ELSE 0
			END
		) = 0
)
DELETE FROM "PresetTaskOrder"
WHERE EXISTS (
	SELECT 1
	FROM "ArtifactUsers"
	WHERE "ArtifactUsers"."householdId" = "PresetTaskOrder"."householdId"
		AND "ArtifactUsers"."userId" = "PresetTaskOrder"."userId"
);

WITH "VisiblePresets" AS (
	SELECT
		"HouseholdMember"."householdId" AS "householdId",
		"HouseholdMember"."userId" AS "userId",
		"PresetTask"."id" AS "presetId",
		"PresetTask"."createdById" AS "presetCreatedById",
		"PresetTask"."createdAt" AS "presetCreatedAt"
	FROM "HouseholdMember"
	INNER JOIN "PresetTask"
		ON "PresetTask"."householdId" = "HouseholdMember"."householdId"
	WHERE "PresetTask"."isShared" = 1 OR "PresetTask"."createdById" = "HouseholdMember"."userId"
),
"ArtifactUsers" AS (
	SELECT
		"VisiblePresets"."householdId",
		"VisiblePresets"."userId"
	FROM "VisiblePresets"
	LEFT JOIN "PresetTaskOrder"
		ON "PresetTaskOrder"."householdId" = "VisiblePresets"."householdId"
		AND "PresetTaskOrder"."userId" = "VisiblePresets"."userId"
		AND "PresetTaskOrder"."presetId" = "VisiblePresets"."presetId"
	GROUP BY "VisiblePresets"."householdId", "VisiblePresets"."userId"
	HAVING COUNT(*) > 0
		AND COUNT("PresetTaskOrder"."presetId") < COUNT(*)
		AND SUM(
			CASE
				WHEN "PresetTaskOrder"."presetId" IS NOT NULL
					AND "VisiblePresets"."presetCreatedById" <> "VisiblePresets"."userId"
				THEN 1
				ELSE 0
			END
		) = 0
),
"RankedVisiblePresets" AS (
	SELECT
		"VisiblePresets"."householdId",
		"VisiblePresets"."userId",
		"VisiblePresets"."presetId",
		ROW_NUMBER() OVER (
			PARTITION BY "VisiblePresets"."householdId", "VisiblePresets"."userId"
			ORDER BY "VisiblePresets"."presetCreatedAt" ASC, "VisiblePresets"."presetId" ASC
		) - 1 AS "sortOrder"
	FROM "VisiblePresets"
	INNER JOIN "ArtifactUsers"
		ON "ArtifactUsers"."householdId" = "VisiblePresets"."householdId"
		AND "ArtifactUsers"."userId" = "VisiblePresets"."userId"
)
INSERT INTO "PresetTaskOrder" ("householdId", "userId", "presetId", "sortOrder")
SELECT "householdId", "userId", "presetId", "sortOrder"
FROM "RankedVisiblePresets";
