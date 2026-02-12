CREATE TABLE "PresetTaskOrder" (
	"householdId" TEXT NOT NULL,
	"userId" TEXT NOT NULL,
	"presetId" TEXT NOT NULL,
	"sortOrder" INTEGER NOT NULL,
	"createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
	"updatedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,

	PRIMARY KEY ("householdId", "userId", "presetId"),
	CONSTRAINT "PresetTaskOrder_householdId_fkey" FOREIGN KEY ("householdId") REFERENCES "Household" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
	CONSTRAINT "PresetTaskOrder_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
	CONSTRAINT "PresetTaskOrder_presetId_fkey" FOREIGN KEY ("presetId") REFERENCES "PresetTask" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

WITH "RankedPresets" AS (
	SELECT
		"householdId",
		"createdById" AS "userId",
		"id" AS "presetId",
		ROW_NUMBER() OVER (PARTITION BY "householdId", "createdById" ORDER BY "createdAt" ASC) - 1 AS "sortOrder"
	FROM "PresetTask"
)
INSERT INTO "PresetTaskOrder" ("householdId", "userId", "presetId", "sortOrder")
SELECT "householdId", "userId", "presetId", "sortOrder"
FROM "RankedPresets";

CREATE INDEX "PresetTaskOrder_householdId_userId_sortOrder_idx" ON "PresetTaskOrder"("householdId", "userId", "sortOrder");
CREATE INDEX "PresetTaskOrder_presetId_idx" ON "PresetTaskOrder"("presetId");
