CREATE TABLE "RewardClaimLimit" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "householdId" TEXT NOT NULL,
    "maxClaims" INTEGER NOT NULL,
    "scope" TEXT NOT NULL DEFAULT 'HOUSEHOLD',
    "userId" TEXT,
    "period" TEXT NOT NULL,
    "windowMinutes" INTEGER,
    "sortOrder" INTEGER NOT NULL,
    CONSTRAINT "RewardClaimLimit_householdId_fkey" FOREIGN KEY ("householdId") REFERENCES "Household" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "RewardClaimLimit_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "RewardClaimLimit_scope_check" CHECK ("scope" IN ('HOUSEHOLD', 'MEMBER') AND ("scope" = 'MEMBER' OR "userId" IS NULL)),
    CONSTRAINT "RewardClaimLimit_maxClaims_check" CHECK ("maxClaims" BETWEEN 1 AND 10000),
    CONSTRAINT "RewardClaimLimit_period_check" CHECK (
        ("period" IN ('DAY', 'WEEK', 'MONTH') AND "windowMinutes" IS NULL)
        OR ("period" = 'ROLLING' AND "windowMinutes" IS NOT NULL AND "windowMinutes" BETWEEN 1 AND 525600)
    )
);

CREATE INDEX "RewardClaimLimit_householdId_sortOrder_idx" ON "RewardClaimLimit"("householdId", "sortOrder");
CREATE INDEX "RewardClaimLimit_userId_idx" ON "RewardClaimLimit"("userId");
CREATE INDEX "PointLog_householdId_kind_status_revertedAt_createdAt_idx" ON "PointLog"("householdId", "kind", "status", "revertedAt", "createdAt");
