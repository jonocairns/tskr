import "server-only";

import { findAllEligibleReminders } from "./evaluation";
import { sendReminders } from "./sender";

const POLL_INTERVAL_MS = 60_000; // 1 minute

let schedulerInterval: NodeJS.Timeout | null = null;

// Global singleton to prevent multiple schedulers
declare global {
	var reminderSchedulerRunning: boolean | undefined;
}

/**
 * Process all eligible reminders
 * This function is scheduler-agnostic and can be called by database polling or Redis job queue
 */
export async function processReminders(): Promise<{ sent: number; failed: number }> {
	const now = new Date();
	console.log(`[reminders] Processing reminders at ${now.toISOString()}`);

	try {
		// Find all eligible reminders
		const eligible = await findAllEligibleReminders(now);

		if (eligible.length === 0) {
			console.log("[reminders] No eligible reminders found");
			return { sent: 0, failed: 0 };
		}

		console.log(`[reminders] Found ${eligible.length} eligible reminders`);

		// Send all reminders
		const result = await sendReminders(eligible);

		console.log(`[reminders] Sent ${result.sent} reminders, ${result.failed} failed`);

		return result;
	} catch (error) {
		console.error("[reminders] Error processing reminders:", error);
		return { sent: 0, failed: 0 };
	}
}

/**
 * Start the reminder scheduler with database polling
 * This implementation uses setInterval - can be replaced with Redis/BullMQ later
 */
export function startReminderScheduler(): void {
	if (globalThis.reminderSchedulerRunning) {
		console.log("[reminders] Scheduler already running");
		return;
	}

	globalThis.reminderSchedulerRunning = true;
	console.log("[reminders] Starting scheduler");

	// Run immediately on startup
	processReminders().catch((err) => console.error("[reminders] Initial run failed:", err));

	// Then run every minute
	schedulerInterval = setInterval(() => {
		processReminders().catch((err) => console.error("[reminders] Scheduled run failed:", err));
	}, POLL_INTERVAL_MS);
}

/**
 * Stop the reminder scheduler
 */
export function stopReminderScheduler(): void {
	if (schedulerInterval) {
		clearInterval(schedulerInterval);
		schedulerInterval = null;
	}
	globalThis.reminderSchedulerRunning = false;
	console.log("[reminders] Scheduler stopped");
}
