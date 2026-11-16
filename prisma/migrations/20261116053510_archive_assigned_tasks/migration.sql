-- AlterTable
ALTER TABLE "AssignedTask" ADD COLUMN "archivedAt" DATETIME;

-- CreateIndex
CREATE INDEX "AssignedTask_householdId_archivedAt_status_idx" ON "AssignedTask"("householdId", "archivedAt", "status");
