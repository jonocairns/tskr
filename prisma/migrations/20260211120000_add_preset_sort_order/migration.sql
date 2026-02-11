ALTER TABLE "PresetTask" ADD COLUMN "sortOrder" INTEGER NOT NULL DEFAULT 0;

WITH "RankedPresets" AS (
	SELECT
		"id",
		ROW_NUMBER() OVER (PARTITION BY "householdId" ORDER BY "isShared" DESC, "createdAt" ASC) - 1 AS "nextOrder"
	FROM "PresetTask"
)
UPDATE "PresetTask"
SET "sortOrder" = (
	SELECT "nextOrder"
	FROM "RankedPresets"
	WHERE "RankedPresets"."id" = "PresetTask"."id"
);

CREATE INDEX "PresetTask_householdId_sortOrder_idx" ON "PresetTask"("householdId", "sortOrder");
