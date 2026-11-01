-- CreateTable
CREATE TABLE "RewardMonthlyPolicy" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "ruleId" TEXT NOT NULL,
    "revision" INTEGER NOT NULL,
    "effectiveMonth" TEXT NOT NULL,
    "recordedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "maxClaims" INTEGER NOT NULL,
    "rolloverEnabled" BOOLEAN NOT NULL,
    "timeZone" TEXT NOT NULL,
    CONSTRAINT "RewardMonthlyPolicy_ruleId_fkey" FOREIGN KEY ("ruleId") REFERENCES "RewardClaimLimit" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "RewardAllowanceAccount" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "ruleId" TEXT NOT NULL,
    "ownerKey" TEXT NOT NULL,
    "initializedAt" DATETIME NOT NULL,
    CONSTRAINT "RewardAllowanceAccount_ruleId_fkey" FOREIGN KEY ("ruleId") REFERENCES "RewardClaimLimit" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "RewardMonthlyGrant" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "accountId" TEXT NOT NULL,
    "month" TEXT NOT NULL,
    "startsAt" DATETIME NOT NULL,
    "endsAt" DATETIME NOT NULL,
    "amount" INTEGER NOT NULL,
    "rolloverEnabled" BOOLEAN NOT NULL,
    "expiresAt" DATETIME,
    "forfeited" INTEGER NOT NULL DEFAULT 0,
    CONSTRAINT "RewardMonthlyGrant_accountId_fkey" FOREIGN KEY ("accountId") REFERENCES "RewardAllowanceAccount" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "RewardClaimAllocation" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "grantId" TEXT NOT NULL,
    "logId" TEXT NOT NULL,
    "releasedAt" DATETIME,
    CONSTRAINT "RewardClaimAllocation_grantId_fkey" FOREIGN KEY ("grantId") REFERENCES "RewardMonthlyGrant" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "RewardClaimAllocation_logId_fkey" FOREIGN KEY ("logId") REFERENCES "PointLog" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- Existing settings and logs are left intact. Bootstrap only the current month
-- on first access; SQLite cannot reconstruct historical household timezone policies.
ALTER TABLE "Household" ADD COLUMN "rewardClaimRevision" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "RewardClaimLimit" ADD COLUMN "rolloverEnabled" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "RewardClaimLimit" ADD COLUMN "archivedAt" DATETIME;

-- CreateIndex
CREATE UNIQUE INDEX "RewardMonthlyPolicy_ruleId_revision_key" ON "RewardMonthlyPolicy"("ruleId", "revision");

-- CreateIndex
CREATE UNIQUE INDEX "RewardAllowanceAccount_ruleId_ownerKey_key" ON "RewardAllowanceAccount"("ruleId", "ownerKey");

-- CreateIndex
CREATE UNIQUE INDEX "RewardMonthlyGrant_accountId_month_key" ON "RewardMonthlyGrant"("accountId", "month");

-- CreateIndex
CREATE INDEX "RewardClaimAllocation_logId_idx" ON "RewardClaimAllocation"("logId");

-- CreateIndex
CREATE UNIQUE INDEX "RewardClaimAllocation_grantId_logId_key" ON "RewardClaimAllocation"("grantId", "logId");
