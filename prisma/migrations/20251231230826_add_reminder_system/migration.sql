-- CreateTable
CREATE TABLE "HouseholdReminderConfig" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "householdId" TEXT NOT NULL,
    "dailyReminderEnabled" BOOLEAN NOT NULL DEFAULT false,
    "dailyReminderTime" TEXT,
    "weeklyReminderEnabled" BOOLEAN NOT NULL DEFAULT false,
    "weeklyReminderDay" INTEGER,
    "weeklyReminderTime" TEXT,
    "intervalReminderEnabled" BOOLEAN NOT NULL DEFAULT false,
    "intervalReminderDays" INTEGER,
    "eventReminderEnabled" BOOLEAN NOT NULL DEFAULT false,
    "eventReminderDays" INTEGER,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "HouseholdReminderConfig_householdId_fkey" FOREIGN KEY ("householdId") REFERENCES "Household" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "UserReminderOverride" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "householdId" TEXT NOT NULL,
    "isPaused" BOOLEAN NOT NULL DEFAULT false,
    "pausedUntil" DATETIME,
    "dailyReminderEnabled" BOOLEAN,
    "dailyReminderTime" TEXT,
    "weeklyReminderEnabled" BOOLEAN,
    "weeklyReminderDay" INTEGER,
    "weeklyReminderTime" TEXT,
    "intervalReminderEnabled" BOOLEAN,
    "intervalReminderDays" INTEGER,
    "eventReminderEnabled" BOOLEAN,
    "eventReminderDays" INTEGER,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "UserReminderOverride_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "ReminderSendLog" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "householdId" TEXT NOT NULL,
    "reminderType" TEXT NOT NULL,
    "sentAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "nextSendAt" DATETIME,
    "status" TEXT NOT NULL,
    "dismissedAt" DATETIME,
    "snoozedUntil" DATETIME,
    "schedulerLockKey" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "ReminderSendLog_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateIndex
CREATE UNIQUE INDEX "HouseholdReminderConfig_householdId_key" ON "HouseholdReminderConfig"("householdId");

-- CreateIndex
CREATE INDEX "HouseholdReminderConfig_householdId_idx" ON "HouseholdReminderConfig"("householdId");

-- CreateIndex
CREATE INDEX "UserReminderOverride_userId_idx" ON "UserReminderOverride"("userId");

-- CreateIndex
CREATE INDEX "UserReminderOverride_householdId_idx" ON "UserReminderOverride"("householdId");

-- CreateIndex
CREATE UNIQUE INDEX "UserReminderOverride_userId_householdId_key" ON "UserReminderOverride"("userId", "householdId");

-- CreateIndex
CREATE INDEX "ReminderSendLog_userId_householdId_idx" ON "ReminderSendLog"("userId", "householdId");

-- CreateIndex
CREATE INDEX "ReminderSendLog_nextSendAt_idx" ON "ReminderSendLog"("nextSendAt");

-- CreateIndex
CREATE INDEX "ReminderSendLog_schedulerLockKey_idx" ON "ReminderSendLog"("schedulerLockKey");

-- CreateIndex
CREATE INDEX "ReminderSendLog_userId_reminderType_sentAt_idx" ON "ReminderSendLog"("userId", "reminderType", "sentAt");

-- CreateIndex
CREATE INDEX "ReminderSendLog_status_nextSendAt_idx" ON "ReminderSendLog"("status", "nextSendAt");
