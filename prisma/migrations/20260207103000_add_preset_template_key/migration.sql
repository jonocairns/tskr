ALTER TABLE "PresetTask" ADD COLUMN "templateKey" TEXT;

UPDATE "PresetTask"
SET "templateKey" = CASE
	WHEN lower(trim("label")) = 'bins' AND "bucket" = 'QUICK' THEN 'bins'
	WHEN lower(trim("label")) = 'toilet' AND "bucket" = 'ROUTINE' THEN 'toilet'
	WHEN lower(trim("label")) = 'kitchen' AND "bucket" = 'QUICK' THEN 'kitchen'
	WHEN lower(trim("label")) = 'cook' AND "bucket" = 'HEAVY' THEN 'cook'
	WHEN lower(trim("label")) = 'dinner dishes' AND "bucket" = 'ROUTINE' THEN 'dinner-dishes'
	WHEN lower(trim("label")) = 'folding' AND "bucket" = 'ROUTINE' THEN 'folding'
	WHEN lower(trim("label")) = 'bed sheets' AND "bucket" = 'QUICK' THEN 'bed-made'
	WHEN lower(trim("label")) = 'lawns' AND "bucket" = 'HEAVY' THEN 'lawns'
	WHEN lower(trim("label")) = 'vanities' AND "bucket" = 'QUICK' THEN 'vanities'
	WHEN lower(trim("label")) = 'vacuum' AND "bucket" = 'CHALLENGING' THEN 'vacuum'
	WHEN lower(trim("label")) = 'laundry' AND "bucket" = 'QUICK' THEN 'laundry'
	WHEN lower(trim("label")) = 'dishwasher' AND "bucket" = 'QUICK' THEN 'dishwasher'
	ELSE "templateKey"
END
WHERE "templateKey" IS NULL;

CREATE INDEX "PresetTask_templateKey_idx" ON "PresetTask"("templateKey");
