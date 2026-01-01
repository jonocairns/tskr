import "server-only";

import { processReminders, startReminderScheduler, stopReminderScheduler } from "./scheduler";

// Auto-start scheduler in server environment only
if (typeof window === "undefined") {
	startReminderScheduler();
}

export { startReminderScheduler, stopReminderScheduler, processReminders };
export { findAllEligibleReminders } from "./evaluation";
export { sendReminder, sendReminders } from "./sender";
