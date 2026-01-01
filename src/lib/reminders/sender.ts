import "server-only";

import { prisma } from "@/lib/prisma";
import { broadcastPush } from "@/lib/push";
import type { EligibleReminder } from "./evaluation";

/**
 * Generate lock key for deduplication
 * Format: {userId}:{householdId}:{type}:{date}
 */
export function generateLockKey(userId: string, householdId: string, type: string, date: Date): string {
	const dateKey = date.toISOString().split("T")[0]; // YYYY-MM-DD
	return `${userId}:${householdId}:${type}:${dateKey}`;
}

/**
 * Calculate next send time based on reminder type
 */
function calculateNextSendTime(_reminderType: string, _now: Date): Date | null {
	// For daily/weekly reminders, next send is calculated by scheduler
	// For interval reminders, it's based on the interval days
	// For event reminders, it's checked dynamically
	// Return null for now - scheduler will handle rescheduling
	return null;
}

/**
 * Get appropriate message for reminder type
 */
function getReminderMessage(reminderType: string): string {
	switch (reminderType) {
		case "DAILY":
			return "Don't forget to complete your daily tasks!";
		case "WEEKLY":
			return "Time to check off your weekly tasks!";
		case "INTERVAL":
			return "It's been a while - time to log some tasks!";
		case "EVENT":
			return "You haven't logged any tasks recently. Time to get back on track!";
		default:
			return "Time to complete your tasks!";
	}
}

/**
 * Send a reminder notification with deduplication
 */
export async function sendReminder(reminder: EligibleReminder): Promise<boolean> {
	const { userId, householdId, reminderType } = reminder;
	const now = new Date();
	const lockKey = generateLockKey(userId, householdId, reminderType, now);

	try {
		let sent = false;

		await prisma.$transaction(async (tx) => {
			// Check if reminder already sent today with this lock key
			const existing = await tx.reminderSendLog.findFirst({
				where: {
					userId,
					householdId,
					reminderType,
					schedulerLockKey: lockKey,
				},
			});

			if (existing) {
				console.log(`[reminders] Already sent: ${lockKey}`);
				return;
			}

			// Check if user is paused
			const override = await tx.userReminderOverride.findUnique({
				where: {
					userId_householdId: {
						userId,
						householdId,
					},
				},
			});

			if (override?.isPaused && override.pausedUntil && override.pausedUntil > now) {
				console.log(`[reminders] User paused: ${userId}`);
				return;
			}

			// Create send log (acts as distributed lock)
			await tx.reminderSendLog.create({
				data: {
					userId,
					householdId,
					reminderType,
					sentAt: now,
					status: "SENT",
					schedulerLockKey: lockKey,
					nextSendAt: calculateNextSendTime(reminderType, now),
				},
			});

			// Send push notification
			const result = await broadcastPush(
				{
					title: "Task Reminder",
					body: getReminderMessage(reminderType),
					url: "/",
					icon: "/icon-192.png",
					badge: "/icon-192.png",
				},
				{ userId, householdId },
			);

			if (result.sent > 0) {
				console.log(`[reminders] Sent ${reminderType} to user ${userId} in household ${householdId}`);
				sent = true;
			}
		});

		return sent;
	} catch (error) {
		console.error(`[reminders] Failed to send ${reminderType} to user ${userId}:`, error);
		return false;
	}
}

/**
 * Send multiple reminders in parallel
 */
export async function sendReminders(reminders: EligibleReminder[]): Promise<{
	sent: number;
	failed: number;
}> {
	const results = await Promise.all(reminders.map((reminder) => sendReminder(reminder)));

	const sent = results.filter((r) => r === true).length;
	const failed = results.filter((r) => r === false).length;

	return { sent, failed };
}
