import { Temporal } from "@js-temporal/polyfill";

import { computeAssignedTaskState } from "../src/lib/assignedTasks";

const TIME_ZONE = "UTC";

const atLocal = (year: number, month: number, day: number, hour = 0, minute = 0, second = 0, ms = 0) =>
	new Date(Date.UTC(year, month - 1, day, hour, minute, second, ms));
const addMinutes = (date: Date, minutes: number) => new Date(date.getTime() + minutes * 60_000);
type ComputeArgs = Parameters<typeof computeAssignedTaskState>[0];

const computeState = (task: ComputeArgs["task"], logs: ComputeArgs["logs"], now: Date) =>
	computeAssignedTaskState({ task, logs, now, timeZone: TIME_ZONE });

const atZoned = (
	timeZone: string,
	year: number,
	month: number,
	day: number,
	hour = 0,
	minute = 0,
	second = 0,
	millisecond = 0,
) =>
	new Date(
		Temporal.ZonedDateTime.from({
			timeZone,
			year,
			month,
			day,
			hour,
			minute,
			second,
			millisecond,
		}).toInstant().epochMilliseconds,
	);

test("returns active state when no logs exist", () => {
	const now = atLocal(2024, 1, 1, 0, 10);
	const expectedReset = atLocal(2024, 1, 1, 1, 0);

	const state = computeState(
		{
			cadenceTarget: 2,
			cadenceIntervalMinutes: 60,
			isRecurring: true,
		},
		[],
		now,
	);

	expect(state.progress).toBe(0);
	expect(state.isActive).toBe(true);
	expect(state.nextResetAt?.getTime()).toBe(expectedReset.getTime());
});

test("non-recurring tasks stop after reaching the target", () => {
	const logs = [
		{ createdAt: atLocal(2024, 1, 1, 0, 0) },
		{ createdAt: atLocal(2024, 1, 1, 0, 10) },
		{ createdAt: atLocal(2024, 1, 1, 0, 20) },
	];

	const state = computeState(
		{
			cadenceTarget: 2,
			cadenceIntervalMinutes: 60,
			isRecurring: false,
		},
		logs,
		atLocal(2024, 1, 1, 1, 0),
	);

	expect(state).toEqual({ progress: 2, isActive: false, nextResetAt: null });
});

test("recurring tasks stay active before reaching the target in the current period", () => {
	const logs = [{ createdAt: atLocal(2024, 1, 1, 0, 5) }, { createdAt: atLocal(2024, 1, 1, 0, 10) }];
	const expectedReset = atLocal(2024, 1, 1, 1, 0);

	const state = computeState(
		{
			cadenceTarget: 3,
			cadenceIntervalMinutes: 60,
			isRecurring: true,
		},
		logs,
		atLocal(2024, 1, 1, 0, 30),
	);

	expect(state.progress).toBe(2);
	expect(state.isActive).toBe(true);
	expect(state.nextResetAt?.getTime()).toBe(expectedReset.getTime());
});

test("recurring tasks become inactive until the next boundary", () => {
	const logs = [{ createdAt: atLocal(2024, 1, 1, 0, 5) }, { createdAt: atLocal(2024, 1, 1, 0, 10) }];
	const expectedReset = atLocal(2024, 1, 1, 1, 0);

	const state = computeState(
		{
			cadenceTarget: 2,
			cadenceIntervalMinutes: 60,
			isRecurring: true,
		},
		logs,
		atLocal(2024, 1, 1, 0, 30),
	);

	expect(state.progress).toBe(2);
	expect(state.isActive).toBe(false);
	expect(state.nextResetAt?.getTime()).toBe(expectedReset.getTime());
});

test("recurring tasks reset progress after the interval elapses", () => {
	const logs = [
		{ createdAt: atLocal(2024, 1, 1, 0, 5) },
		{ createdAt: atLocal(2024, 1, 1, 0, 10) },
		{ createdAt: atLocal(2024, 1, 1, 0, 20) },
	];
	const expectedReset = atLocal(2024, 1, 1, 2, 0);

	const state = computeState(
		{
			cadenceTarget: 2,
			cadenceIntervalMinutes: 60,
			isRecurring: true,
		},
		logs,
		atLocal(2024, 1, 1, 1, 10),
	);

	expect(state.progress).toBe(0);
	expect(state.isActive).toBe(true);
	expect(state.nextResetAt?.getTime()).toBe(expectedReset.getTime());
});

test("recurring tasks activate at the exact reset time", () => {
	const logs = [{ createdAt: atLocal(2024, 1, 1, 0, 5) }, { createdAt: atLocal(2024, 1, 1, 0, 10) }];
	const resetAt = atLocal(2024, 1, 1, 1, 0);
	const expectedReset = atLocal(2024, 1, 1, 2, 0);

	const state = computeState(
		{
			cadenceTarget: 2,
			cadenceIntervalMinutes: 60,
			isRecurring: true,
		},
		logs,
		resetAt,
	);

	expect(state.progress).toBe(0);
	expect(state.isActive).toBe(true);
	expect(state.nextResetAt?.getTime()).toBe(expectedReset.getTime());
});

test("daily recurring tasks reset at local midnight", () => {
	const completedAt = atLocal(2024, 1, 1, 23, 30);
	const logs = [{ createdAt: completedAt }];
	const beforeReset = atLocal(2024, 1, 1, 23, 45);
	const expectedReset = atLocal(2024, 1, 2, 0, 0);

	const state = computeState(
		{
			cadenceTarget: 1,
			cadenceIntervalMinutes: 1440,
			isRecurring: true,
		},
		logs,
		beforeReset,
	);

	expect(state.progress).toBe(1);
	expect(state.isActive).toBe(false);
	expect(state.nextResetAt?.getTime()).toBe(expectedReset.getTime());
});

test("weekly recurring tasks reset on Mondays", () => {
	const completedAt = atLocal(2024, 1, 3, 15, 30);
	const logs = [{ createdAt: completedAt }];
	const expectedReset = atLocal(2024, 1, 8, 0, 0);

	const state = computeState(
		{
			cadenceTarget: 1,
			cadenceIntervalMinutes: 10080,
			isRecurring: true,
		},
		logs,
		atLocal(2024, 1, 5, 12, 0),
	);

	expect(state.progress).toBe(1);
	expect(state.isActive).toBe(false);
	expect(state.nextResetAt?.getTime()).toBe(expectedReset.getTime());
});

test("fortnightly recurring tasks reset every other Monday", () => {
	const completedAt = atLocal(2024, 1, 3, 15, 30);
	const logs = [{ createdAt: completedAt }];
	const expectedReset = atLocal(2024, 1, 15, 0, 0);

	const state = computeState(
		{
			cadenceTarget: 1,
			cadenceIntervalMinutes: 20160,
			isRecurring: true,
		},
		logs,
		atLocal(2024, 1, 5, 12, 0),
	);

	expect(state.progress).toBe(1);
	expect(state.isActive).toBe(false);
	expect(state.nextResetAt?.getTime()).toBe(expectedReset.getTime());
});

test("multi-day recurring tasks reset on anchored day blocks", () => {
	const completedAt = atLocal(2024, 1, 1, 23, 0);
	const logs = [{ createdAt: completedAt }];
	const expectedReset = atLocal(2024, 1, 4, 0, 0);

	const state = computeState(
		{
			cadenceTarget: 1,
			cadenceIntervalMinutes: 2880,
			isRecurring: true,
		},
		logs,
		atLocal(2024, 1, 2, 12, 0),
	);

	expect(state.progress).toBe(0);
	expect(state.isActive).toBe(true);
	expect(state.nextResetAt?.getTime()).toBe(expectedReset.getTime());
});

test("handles cadenceTarget of zero by treating it as 1", () => {
	const logs = [{ createdAt: atLocal(2024, 1, 1, 0, 0) }];
	const expectedReset = atLocal(2024, 1, 1, 1, 0);

	const state = computeState(
		{
			cadenceTarget: 0,
			cadenceIntervalMinutes: 60,
			isRecurring: true,
		},
		logs,
		atLocal(2024, 1, 1, 0, 30),
	);

	expect(state.progress).toBe(1);
	expect(state.isActive).toBe(false);
	expect(state.nextResetAt?.getTime()).toBe(expectedReset.getTime());
});

test("handles cadenceIntervalMinutes of zero by treating it as 1", () => {
	const t0 = atLocal(2024, 1, 1, 0, 0);
	const logs = [{ createdAt: t0 }];
	const expectedReset = atLocal(2024, 1, 1, 0, 3);

	const state = computeState(
		{
			cadenceTarget: 1,
			cadenceIntervalMinutes: 0,
			isRecurring: true,
		},
		logs,
		atLocal(2024, 1, 1, 0, 2),
	);

	expect(state.isActive).toBe(true);
	expect(state.progress).toBe(0);
	expect(state.nextResetAt?.getTime()).toBe(expectedReset.getTime());
});

test("handles unsorted logs correctly", () => {
	const t0 = atLocal(2024, 1, 1, 0, 0);
	const t1 = atLocal(2024, 1, 1, 0, 30);
	const t2 = atLocal(2024, 1, 1, 0, 15);
	const logs = [{ createdAt: t1 }, { createdAt: t0 }, { createdAt: t2 }];
	const expectedReset = atLocal(2024, 1, 1, 1, 0);

	const state = computeState(
		{
			cadenceTarget: 3,
			cadenceIntervalMinutes: 60,
			isRecurring: true,
		},
		logs,
		atLocal(2024, 1, 1, 0, 45),
	);

	expect(state.progress).toBe(3);
	expect(state.isActive).toBe(false);
	expect(state.nextResetAt?.getTime()).toBe(expectedReset.getTime());
});

test("non-recurring task with logs beyond target counts only up to target", () => {
	const logs = [
		{ createdAt: atLocal(2024, 1, 1, 0, 0) },
		{ createdAt: atLocal(2024, 1, 1, 0, 10) },
		{ createdAt: atLocal(2024, 1, 1, 0, 20) },
		{ createdAt: atLocal(2024, 1, 1, 0, 30) },
		{ createdAt: atLocal(2024, 1, 1, 0, 40) },
	];

	const state = computeState(
		{
			cadenceTarget: 3,
			cadenceIntervalMinutes: 60,
			isRecurring: false,
		},
		logs,
		atLocal(2024, 1, 1, 1, 0),
	);

	expect(state.progress).toBe(3);
	expect(state.isActive).toBe(false);
	expect(state.nextResetAt).toBeNull();
});

test("hourly tasks snap to hour boundaries across midnight", () => {
	const completedAt = atLocal(2024, 1, 1, 23, 30);
	const logs = [{ createdAt: completedAt }];
	const expectedReset = atLocal(2024, 1, 2, 1, 0);

	const state = computeState(
		{
			cadenceTarget: 1,
			cadenceIntervalMinutes: 60,
			isRecurring: true,
		},
		logs,
		atLocal(2024, 1, 2, 0, 15),
	);

	expect(state.progress).toBe(0);
	expect(state.isActive).toBe(true);
	expect(state.nextResetAt?.getTime()).toBe(expectedReset.getTime());
});

test("monthly recurring tasks reset at the start of the month", () => {
	const completedAt = atLocal(2024, 1, 15, 10, 30);
	const logs = [{ createdAt: completedAt }];
	const expectedReset = atLocal(2024, 3, 1, 0, 0);

	const state = computeState(
		{
			cadenceTarget: 1,
			cadenceIntervalMinutes: 43200,
			isRecurring: true,
		},
		logs,
		atLocal(2024, 2, 1, 12, 0),
	);

	expect(state.progress).toBe(0);
	expect(state.isActive).toBe(true);
	expect(state.nextResetAt?.getTime()).toBe(expectedReset.getTime());
});

test("quarterly recurring tasks reset at the start of the quarter", () => {
	const completedAt = atLocal(2024, 2, 15, 10, 30);
	const logs = [{ createdAt: completedAt }];
	const expectedReset = atLocal(2024, 4, 1, 0, 0);

	const state = computeState(
		{
			cadenceTarget: 1,
			cadenceIntervalMinutes: 129600,
			isRecurring: true,
		},
		logs,
		atLocal(2024, 3, 10, 12, 0),
	);

	expect(state.progress).toBe(1);
	expect(state.isActive).toBe(false);
	expect(state.nextResetAt?.getTime()).toBe(expectedReset.getTime());
});

test("yearly recurring tasks reset at the start of the year", () => {
	const completedAt = atLocal(2024, 2, 1, 10, 30);
	const logs = [{ createdAt: completedAt }];
	const expectedReset = atLocal(2025, 1, 1, 0, 0);

	const state = computeState(
		{
			cadenceTarget: 1,
			cadenceIntervalMinutes: 525600,
			isRecurring: true,
		},
		logs,
		atLocal(2024, 7, 4, 12, 0),
	);

	expect(state.progress).toBe(1);
	expect(state.isActive).toBe(false);
	expect(state.nextResetAt?.getTime()).toBe(expectedReset.getTime());
});

test("task becomes active at exact reset time with progress reset", () => {
	const logs = [
		{ createdAt: atLocal(2024, 1, 1, 0, 0) },
		{ createdAt: atLocal(2024, 1, 1, 0, 10) },
		{ createdAt: atLocal(2024, 1, 1, 0, 20) },
	];
	const resetTime = atLocal(2024, 1, 1, 1, 0);
	const expectedReset = atLocal(2024, 1, 1, 2, 0);

	const state = computeState(
		{
			cadenceTarget: 2,
			cadenceIntervalMinutes: 60,
			isRecurring: true,
		},
		logs,
		resetTime,
	);

	expect(state.progress).toBe(0);
	expect(state.isActive).toBe(true);
	expect(state.nextResetAt?.getTime()).toBe(expectedReset.getTime());
});

test("non-recurring task remains active when below target", () => {
	const logs = [{ createdAt: atLocal(2024, 1, 1, 0, 0) }];

	const state = computeState(
		{
			cadenceTarget: 5,
			cadenceIntervalMinutes: 60,
			isRecurring: false,
		},
		logs,
		atLocal(2024, 1, 1, 1, 0),
	);

	expect(state.progress).toBe(1);
	expect(state.isActive).toBe(true);
	expect(state.nextResetAt).toBeNull();
});

test("handles fractional cadence intervals (90 minutes)", () => {
	const t0 = atLocal(2024, 1, 1, 0, 0);
	const logs = [{ createdAt: t0 }];
	const expectedReset = atLocal(2024, 1, 1, 1, 30);

	const state = computeState(
		{
			cadenceTarget: 1,
			cadenceIntervalMinutes: 90,
			isRecurring: true,
		},
		logs,
		addMinutes(t0, 45),
	);

	expect(state.isActive).toBe(false);
	expect(state.nextResetAt?.getTime()).toBe(expectedReset.getTime());
});

test("sub-day cadence follows wall-clock time on DST fallback", () => {
	const timeZone = "America/New_York";
	const now = atZoned(timeZone, 2024, 11, 3, 3, 30);
	const expectedReset = atZoned(timeZone, 2024, 11, 3, 4, 30);

	const state = computeAssignedTaskState({
		task: { cadenceTarget: 1, cadenceIntervalMinutes: 90, isRecurring: true },
		logs: [],
		now,
		timeZone,
	});

	expect(state.progress).toBe(0);
	expect(state.isActive).toBe(true);
	expect(state.nextResetAt?.getTime()).toBe(expectedReset.getTime());
});
