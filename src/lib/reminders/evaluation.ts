import "server-only";

import type { HouseholdReminderConfig, UserReminderOverride } from "@prisma/client";
import { prisma } from "@/lib/prisma";

export type EligibleReminder = {
	userId: string;
	householdId: string;
	reminderType: "DAILY" | "WEEKLY" | "INTERVAL" | "EVENT";
};

type ResolvedConfig = {
	dailyEnabled: boolean;
	dailyTime: string | null;
	weeklyEnabled: boolean;
	weeklyDay: number | null;
	weeklyTime: string | null;
	intervalEnabled: boolean;
	intervalDays: number | null;
	eventEnabled: boolean;
	eventDays: number | null;
};

/**
 * Resolve user's effective reminder configuration by applying overrides
 */
function resolveReminderConfig(
	householdConfig: HouseholdReminderConfig,
	userOverride: UserReminderOverride | null,
): ResolvedConfig {
	return {
		dailyEnabled: userOverride?.dailyReminderEnabled ?? householdConfig.dailyReminderEnabled,
		dailyTime: userOverride?.dailyReminderTime ?? householdConfig.dailyReminderTime,
		weeklyEnabled: userOverride?.weeklyReminderEnabled ?? householdConfig.weeklyReminderEnabled,
		weeklyDay: userOverride?.weeklyReminderDay ?? householdConfig.weeklyReminderDay,
		weeklyTime: userOverride?.weeklyReminderTime ?? householdConfig.weeklyReminderTime,
		intervalEnabled: userOverride?.intervalReminderEnabled ?? householdConfig.intervalReminderEnabled,
		intervalDays: userOverride?.intervalReminderDays ?? householdConfig.intervalReminderDays,
		eventEnabled: userOverride?.eventReminderEnabled ?? householdConfig.eventReminderEnabled,
		eventDays: userOverride?.eventReminderDays ?? householdConfig.eventReminderDays,
	};
}

/**
 * Check if user is currently paused
 */
function isUserPaused(userOverride: UserReminderOverride | null, now: Date): boolean {
	if (!userOverride?.isPaused) return false;
	if (!userOverride.pausedUntil) return userOverride.isPaused;
	return userOverride.pausedUntil > now;
}

/**
 * Get current UTC time in HH:MM format
 */
function getCurrentUTCTime(): string {
	const now = new Date();
	const hours = String(now.getUTCHours()).padStart(2, "0");
	const minutes = String(now.getUTCMinutes()).padStart(2, "0");
	return `${hours}:${minutes}`;
}

/**
 * Find users eligible for daily reminders at current time
 */
export async function findDailyReminders(now: Date): Promise<EligibleReminder[]> {
	const currentTime = getCurrentUTCTime();

	// Find all household configs with daily reminders enabled at this time
	const configs = await prisma.householdReminderConfig.findMany({
		where: {
			dailyReminderEnabled: true,
			dailyReminderTime: currentTime,
		},
		include: {
			household: {
				include: {
					members: {
						include: {
							user: {
								include: {
									reminderOverrides: true,
								},
							},
						},
					},
				},
			},
		},
	});

	const eligible: EligibleReminder[] = [];

	for (const config of configs) {
		for (const member of config.household.members) {
			const userOverride = member.user.reminderOverrides.find((o) => o.householdId === config.householdId);

			// Skip if user is paused
			if (isUserPaused(userOverride || null, now)) continue;

			const resolved = resolveReminderConfig(config, userOverride || null);

			// Check if user has daily reminder enabled (accounting for overrides)
			if (resolved.dailyEnabled && resolved.dailyTime === currentTime) {
				eligible.push({
					userId: member.userId,
					householdId: config.householdId,
					reminderType: "DAILY",
				});
			}
		}
	}

	return eligible;
}

/**
 * Find users eligible for weekly reminders at current time
 */
export async function findWeeklyReminders(now: Date): Promise<EligibleReminder[]> {
	const currentTime = getCurrentUTCTime();
	const currentDay = now.getUTCDay(); // 0 = Sunday, 6 = Saturday

	// Find all household configs with weekly reminders enabled
	const configs = await prisma.householdReminderConfig.findMany({
		where: {
			weeklyReminderEnabled: true,
			weeklyReminderDay: currentDay,
			weeklyReminderTime: currentTime,
		},
		include: {
			household: {
				include: {
					members: {
						include: {
							user: {
								include: {
									reminderOverrides: true,
								},
							},
						},
					},
				},
			},
		},
	});

	const eligible: EligibleReminder[] = [];

	for (const config of configs) {
		for (const member of config.household.members) {
			const userOverride = member.user.reminderOverrides.find((o) => o.householdId === config.householdId);

			// Skip if user is paused
			if (isUserPaused(userOverride || null, now)) continue;

			const resolved = resolveReminderConfig(config, userOverride || null);

			// Check if user has weekly reminder enabled (accounting for overrides)
			if (resolved.weeklyEnabled && resolved.weeklyDay === currentDay && resolved.weeklyTime === currentTime) {
				eligible.push({
					userId: member.userId,
					householdId: config.householdId,
					reminderType: "WEEKLY",
				});
			}
		}
	}

	return eligible;
}

/**
 * Find users eligible for interval-based reminders
 */
export async function findIntervalReminders(now: Date): Promise<EligibleReminder[]> {
	// Find all household configs with interval reminders
	const configs = await prisma.householdReminderConfig.findMany({
		where: {
			intervalReminderEnabled: true,
			NOT: { intervalReminderDays: null },
		},
		include: {
			household: {
				include: {
					members: {
						include: {
							user: {
								include: {
									reminderOverrides: true,
									reminderSendLogs: {
										where: {
											reminderType: "INTERVAL",
											status: { in: ["SENT", "SNOOZED"] },
										},
										orderBy: { sentAt: "desc" },
										take: 1,
									},
								},
							},
						},
					},
				},
			},
		},
	});

	const eligible: EligibleReminder[] = [];

	for (const config of configs) {
		for (const member of config.household.members) {
			const userOverride = member.user.reminderOverrides.find((o) => o.householdId === config.householdId);

			// Skip if user is paused
			if (isUserPaused(userOverride || null, now)) continue;

			const resolved = resolveReminderConfig(config, userOverride || null);

			if (!resolved.intervalEnabled || !resolved.intervalDays) continue;

			// Get last send for this user in this household
			const lastSend = member.user.reminderSendLogs.find((log) => log.householdId === config.householdId);

			// If never sent, they're eligible
			if (!lastSend) {
				eligible.push({
					userId: member.userId,
					householdId: config.householdId,
					reminderType: "INTERVAL",
				});
				continue;
			}

			// Check if interval has elapsed
			const nextSendAt = new Date(lastSend.sentAt);
			nextSendAt.setDate(nextSendAt.getDate() + resolved.intervalDays);

			if (now >= nextSendAt) {
				eligible.push({
					userId: member.userId,
					householdId: config.householdId,
					reminderType: "INTERVAL",
				});
			}
		}
	}

	return eligible;
}

/**
 * Find users eligible for event-based reminders (no tasks completed in N days)
 */
export async function findEventReminders(now: Date): Promise<EligibleReminder[]> {
	// Find all household configs with event reminders
	const configs = await prisma.householdReminderConfig.findMany({
		where: {
			eventReminderEnabled: true,
			NOT: { eventReminderDays: null },
		},
		include: {
			household: {
				include: {
					members: {
						include: {
							user: {
								include: {
									reminderOverrides: true,
								},
							},
						},
					},
				},
			},
		},
	});

	const eligible: EligibleReminder[] = [];

	for (const config of configs) {
		for (const member of config.household.members) {
			const userOverride = member.user.reminderOverrides.find((o) => o.householdId === config.householdId);

			// Skip if user is paused
			if (isUserPaused(userOverride || null, now)) continue;

			const resolved = resolveReminderConfig(config, userOverride || null);

			if (!resolved.eventEnabled || !resolved.eventDays) continue;

			// Check if user has completed any tasks in last N days
			const nDaysAgo = new Date(now);
			nDaysAgo.setDate(nDaysAgo.getDate() - resolved.eventDays);

			const recentTaskCount = await prisma.pointLog.count({
				where: {
					userId: member.userId,
					householdId: config.householdId,
					revertedAt: null,
					status: { in: ["APPROVED", "PENDING"] },
					kind: { in: ["PRESET", "TIMED"] },
					createdAt: { gte: nDaysAgo },
				},
			});

			// If no recent tasks, send reminder
			if (recentTaskCount === 0) {
				eligible.push({
					userId: member.userId,
					householdId: config.householdId,
					reminderType: "EVENT",
				});
			}
		}
	}

	return eligible;
}

/**
 * Find all eligible reminders across all types
 */
export async function findAllEligibleReminders(now: Date = new Date()): Promise<EligibleReminder[]> {
	const [daily, weekly, interval, event] = await Promise.all([
		findDailyReminders(now),
		findWeeklyReminders(now),
		findIntervalReminders(now),
		findEventReminders(now),
	]);

	return [...daily, ...weekly, ...interval, ...event];
}
