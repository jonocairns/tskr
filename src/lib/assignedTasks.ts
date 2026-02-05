import { Temporal } from "@js-temporal/polyfill";

import {
	addDaysInTimeZone,
	addMonthsInTimeZone,
	addYearsInTimeZone,
	getStartOfDayInTimeZone,
	getStartOfMonthInTimeZone,
	getStartOfQuarterInTimeZone,
	getStartOfWeekInTimeZone,
	getStartOfYearInTimeZone,
	getTimeZoneDayNumber,
} from "@/lib/timeZones";

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

const startOfDay = (date: Date, timeZone: string) => {
	return getStartOfDayInTimeZone(date, timeZone);
};

const MINUTES_IN_DAY = Temporal.Duration.from({ days: 1 }).total({ unit: "minutes" });
const MINUTES_IN_WEEK = Temporal.Duration.from({ days: 7 }).total({ unit: "minutes" });
const MINUTES_IN_FORTNIGHT = Temporal.Duration.from({ days: 14 }).total({ unit: "minutes" });
const MINUTES_IN_MONTH = Temporal.Duration.from({ days: 30 }).total({ unit: "minutes" });
const MINUTES_IN_QUARTER = Temporal.Duration.from({ days: 90 }).total({ unit: "minutes" });
const MINUTES_IN_YEAR = Temporal.Duration.from({ days: 365 }).total({ unit: "minutes" });

const startOfWeek = (date: Date, timeZone: string) => {
	return getStartOfWeekInTimeZone(date, timeZone);
};

const addDays = (date: Date, days: number, timeZone: string) => {
	return addDaysInTimeZone(date, days, timeZone);
};

const getEpochAnchor = (timeZone: string) => {
	return new Date(
		Temporal.ZonedDateTime.from({ timeZone, year: 1970, month: 1, day: 1 }).toInstant().epochMilliseconds,
	);
};

const getPeriodBounds = (now: Date, intervalMinutes: number, timeZone: string) => {
	const intervalMs = intervalMinutes * 60_000;

	if (intervalMinutes === MINUTES_IN_DAY) {
		const periodStart = startOfDay(now, timeZone);
		return { periodStart, periodEnd: addDays(periodStart, 1, timeZone) };
	}

	if (intervalMinutes === MINUTES_IN_WEEK) {
		const periodStart = startOfWeek(now, timeZone);
		return { periodStart, periodEnd: addDays(periodStart, 7, timeZone) };
	}

	if (intervalMinutes === MINUTES_IN_FORTNIGHT) {
		const anchorBase = getEpochAnchor(timeZone);
		const anchor = getStartOfWeekInTimeZone(anchorBase, timeZone);
		const weeksSinceAnchor = Math.floor(
			(getTimeZoneDayNumber(getStartOfWeekInTimeZone(now, timeZone), timeZone) -
				getTimeZoneDayNumber(anchor, timeZone)) /
				7,
		);
		const periodStart = addDays(anchor, Math.floor(weeksSinceAnchor / 2) * 14, timeZone);
		return { periodStart, periodEnd: addDays(periodStart, 14, timeZone) };
	}

	if (intervalMinutes === MINUTES_IN_MONTH) {
		const periodStart = getStartOfMonthInTimeZone(now, timeZone);
		return { periodStart, periodEnd: addMonthsInTimeZone(periodStart, 1, timeZone) };
	}

	if (intervalMinutes === MINUTES_IN_QUARTER) {
		const periodStart = getStartOfQuarterInTimeZone(now, timeZone);
		return { periodStart, periodEnd: addMonthsInTimeZone(periodStart, 3, timeZone) };
	}

	if (intervalMinutes === MINUTES_IN_YEAR) {
		const periodStart = getStartOfYearInTimeZone(now, timeZone);
		return { periodStart, periodEnd: addYearsInTimeZone(periodStart, 1, timeZone) };
	}

	if (intervalMinutes % MINUTES_IN_DAY === 0) {
		const daysInterval = Math.max(1, intervalMinutes / MINUTES_IN_DAY);
		const anchorBase = getEpochAnchor(timeZone);
		const anchor = startOfDay(anchorBase, timeZone);
		const daysSinceAnchor = getTimeZoneDayNumber(now, timeZone) - getTimeZoneDayNumber(anchor, timeZone);
		const periodStart = addDays(anchor, Math.floor(daysSinceAnchor / daysInterval) * daysInterval, timeZone);
		return { periodStart, periodEnd: addDays(periodStart, daysInterval, timeZone) };
	}

	const start = startOfDay(now, timeZone);
	const minutesSinceMidnight = Math.floor((now.getTime() - start.getTime()) / 60_000);
	const periodStartMinutes = Math.floor(minutesSinceMidnight / intervalMinutes) * intervalMinutes;
	const periodStart = new Date(start.getTime() + periodStartMinutes * 60_000);
	return { periodStart, periodEnd: new Date(periodStart.getTime() + intervalMs) };
};

type ComputeAssignedTaskStateInput = {
	task: AssignedTaskConfig;
	logs: AssignedTaskLog[];
	now?: Date;
	timeZone: string;
};

export const computeAssignedTaskState = ({
	task,
	logs,
	now = new Date(),
	timeZone,
}: ComputeAssignedTaskStateInput): AssignedTaskState => {
	const target = Math.max(task.cadenceTarget, 1);
	const intervalMinutes = Math.max(task.cadenceIntervalMinutes, 1);
	const sortedLogs = [...logs].sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime());

	const totalCount = sortedLogs.length;

	if (!task.isRecurring) {
		return totalCount >= target
			? { progress: target, isActive: false, nextResetAt: null }
			: { progress: totalCount, isActive: true, nextResetAt: null };
	}

	const { periodStart, periodEnd } = getPeriodBounds(now, intervalMinutes, timeZone);
	const periodCount = sortedLogs.filter((log) => log.createdAt >= periodStart && log.createdAt < periodEnd).length;

	if (periodCount >= target) {
		return { progress: target, isActive: false, nextResetAt: periodEnd };
	}

	return { progress: periodCount, isActive: true, nextResetAt: periodEnd };
};
