export type AssignedTaskLog = {
	createdAt: Date;
};

export type AssignedTaskConfig = {
	cadenceTarget: number;
	cadenceIntervalMinutes: number;
	isRecurring: boolean;
};

export type AssignedTaskState = {
	progress: number;
	isActive: boolean;
	nextResetAt: Date | null;
};

const startOfDay = (date: Date) => {
	const start = new Date(date);
	start.setHours(0, 0, 0, 0);
	return start;
};

const MINUTES_IN_DAY = 1440;
const MINUTES_IN_WEEK = 10080;
const MINUTES_IN_FORTNIGHT = 20160;
const MINUTES_IN_MONTH = 43200;
const MINUTES_IN_QUARTER = 129600;
const MINUTES_IN_YEAR = 525600;

const startOfWeek = (date: Date) => {
	const start = startOfDay(date);
	const day = start.getDay();
	const diff = (day + 6) % 7;
	start.setDate(start.getDate() - diff);
	return start;
};

const startOfMonth = (date: Date) => {
	return new Date(date.getFullYear(), date.getMonth(), 1, 0, 0, 0, 0);
};

const startOfQuarter = (date: Date) => {
	const quarterStartMonth = Math.floor(date.getMonth() / 3) * 3;
	return new Date(date.getFullYear(), quarterStartMonth, 1, 0, 0, 0, 0);
};

const startOfYear = (date: Date) => {
	return new Date(date.getFullYear(), 0, 1, 0, 0, 0, 0);
};

const dayNumber = (date: Date) => {
	return Math.floor(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()) / 86_400_000);
};

const addDays = (date: Date, days: number) => {
	const next = new Date(date);
	next.setDate(next.getDate() + days);
	return next;
};

const getPeriodBounds = (now: Date, intervalMinutes: number) => {
	const intervalMs = intervalMinutes * 60_000;

	if (intervalMinutes === MINUTES_IN_DAY) {
		const periodStart = startOfDay(now);
		return { periodStart, periodEnd: addDays(periodStart, 1) };
	}

	if (intervalMinutes === MINUTES_IN_WEEK) {
		const periodStart = startOfWeek(now);
		return { periodStart, periodEnd: addDays(periodStart, 7) };
	}

	if (intervalMinutes === MINUTES_IN_FORTNIGHT) {
		const anchor = startOfWeek(new Date(1970, 0, 1));
		const weeksSinceAnchor = Math.floor((dayNumber(startOfWeek(now)) - dayNumber(anchor)) / 7);
		const periodStart = addDays(anchor, Math.floor(weeksSinceAnchor / 2) * 14);
		return { periodStart, periodEnd: addDays(periodStart, 14) };
	}

	if (intervalMinutes === MINUTES_IN_MONTH) {
		const periodStart = startOfMonth(now);
		const periodEnd = new Date(periodStart);
		periodEnd.setMonth(periodEnd.getMonth() + 1);
		return { periodStart, periodEnd };
	}

	if (intervalMinutes === MINUTES_IN_QUARTER) {
		const periodStart = startOfQuarter(now);
		const periodEnd = new Date(periodStart);
		periodEnd.setMonth(periodEnd.getMonth() + 3);
		return { periodStart, periodEnd };
	}

	if (intervalMinutes === MINUTES_IN_YEAR) {
		const periodStart = startOfYear(now);
		const periodEnd = new Date(periodStart);
		periodEnd.setFullYear(periodEnd.getFullYear() + 1);
		return { periodStart, periodEnd };
	}

	if (intervalMinutes % MINUTES_IN_DAY === 0) {
		const daysInterval = Math.max(1, intervalMinutes / MINUTES_IN_DAY);
		const anchor = startOfDay(new Date(1970, 0, 1));
		const daysSinceAnchor = dayNumber(now) - dayNumber(anchor);
		const periodStart = addDays(anchor, Math.floor(daysSinceAnchor / daysInterval) * daysInterval);
		return { periodStart, periodEnd: addDays(periodStart, daysInterval) };
	}

	const start = startOfDay(now);
	const minutesSinceMidnight = Math.floor((now.getTime() - start.getTime()) / 60_000);
	const periodStartMinutes = Math.floor(minutesSinceMidnight / intervalMinutes) * intervalMinutes;
	const periodStart = new Date(start.getTime() + periodStartMinutes * 60_000);
	return { periodStart, periodEnd: new Date(periodStart.getTime() + intervalMs) };
};

export function computeAssignedTaskState(
	task: AssignedTaskConfig,
	logs: AssignedTaskLog[],
	now = new Date(),
): AssignedTaskState {
	const target = Math.max(task.cadenceTarget, 1);
	const intervalMinutes = Math.max(task.cadenceIntervalMinutes, 1);
	const sortedLogs = [...logs].sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime());

	const totalCount = sortedLogs.length;

	if (!task.isRecurring) {
		return totalCount >= target
			? { progress: target, isActive: false, nextResetAt: null }
			: { progress: totalCount, isActive: true, nextResetAt: null };
	}

	const { periodStart, periodEnd } = getPeriodBounds(now, intervalMinutes);
	const periodCount = sortedLogs.filter((log) => log.createdAt >= periodStart && log.createdAt < periodEnd).length;

	if (periodCount >= target) {
		return { progress: target, isActive: false, nextResetAt: periodEnd };
	}

	return { progress: periodCount, isActive: true, nextResetAt: periodEnd };
}
