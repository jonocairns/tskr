-- CreateIndex
CREATE INDEX "Account_userId_idx" ON "Account"("userId");

-- CreateIndex
CREATE INDEX "HouseholdInvite_invitedById_idx" ON "HouseholdInvite"("invitedById");

-- CreateIndex
CREATE INDEX "HouseholdInvite_expiresAt_idx" ON "HouseholdInvite"("expiresAt");

-- CreateIndex
CREATE INDEX "HouseholdMember_householdId_role_idx" ON "HouseholdMember"("householdId", "role");

-- CreateIndex
CREATE INDEX "PointLog_householdId_status_kind_idx" ON "PointLog"("householdId", "status", "kind");

-- CreateIndex
CREATE INDEX "PointLog_householdId_revertedAt_status_idx" ON "PointLog"("householdId", "revertedAt", "status");

-- CreateIndex
CREATE INDEX "PointLog_userId_householdId_revertedAt_status_idx" ON "PointLog"("userId", "householdId", "revertedAt", "status");

-- CreateIndex
CREATE INDEX "PointLog_assignedTaskId_status_revertedAt_idx" ON "PointLog"("assignedTaskId", "status", "revertedAt");

-- CreateIndex
CREATE INDEX "Session_userId_idx" ON "Session"("userId");
