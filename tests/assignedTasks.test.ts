import { computeAssignedTaskState } from "../src/lib/assignedTasks";

const at = (iso: string) => new Date(iso);
const atLocal = (year: number, month: number, day: number, hour = 0, minute = 0, second = 0, ms = 0) =>
	new Date(year, month - 1, day, hour, minute, second, ms);
const addMinutes = (date: Date, minutes: number) => new Date(date.getTime() + minutes * 60_000);

test("returns active state when no logs exist", () => {
	const state = computeAssignedTaskState(
		{
			cadenceTarget: 2,
			cadenceIntervalMinutes: 60,
			isRecurring: true,
		},
		[],
		at("2024-01-01T00:00:00.000Z"),
	);

	expect(state).toEqual({ progress: 0, isActive: true, nextResetAt: null });
});

test("non-recurring tasks stop after reaching the target", () => {
	const logs = [
		{ createdAt: at("2024-01-01T00:00:00.000Z") },
		{ createdAt: at("2024-01-01T00:10:00.000Z") },
		{ createdAt: at("2024-01-01T00:20:00.000Z") },
	];

	const state = computeAssignedTaskState(
		{
			cadenceTarget: 2,
			cadenceIntervalMinutes: 60,
			isRecurring: false,
		},
		logs,
		at("2024-01-01T01:00:00.000Z"),
	);

	expect(state).toEqual({ progress: 2, isActive: false, nextResetAt: null });
});

test("recurring tasks stay active before reaching the target", () => {
	const logs = [{ createdAt: at("2024-01-01T00:00:00.000Z") }, { createdAt: at("2024-01-01T00:10:00.000Z") }];

	const state = computeAssignedTaskState(
		{
			cadenceTarget: 3,
			cadenceIntervalMinutes: 60,
			isRecurring: true,
		},
		logs,
		at("2024-01-01T01:00:00.000Z"),
	);

	expect(state).toEqual({ progress: 2, isActive: true, nextResetAt: null });
});

test("recurring tasks become inactive until the reset interval passes", () => {
	const t0 = at("2024-01-01T00:00:00.000Z");
	const t1 = at("2024-01-01T00:10:00.000Z");
	const logs = [{ createdAt: t1 }, { createdAt: t0 }];

	const state = computeAssignedTaskState(
		{
			cadenceTarget: 2,
			cadenceIntervalMinutes: 60,
			isRecurring: true,
		},
		logs,
		addMinutes(t1, 30),
	);

	expect(state.progress).toBe(2);
	expect(state.isActive).toBe(false);
	expect(state.nextResetAt?.toISOString()).toBe(addMinutes(t1, 60).toISOString());
});

test("recurring tasks reset progress after the interval elapses", () => {
	const t0 = at("2024-01-01T00:00:00.000Z");
	const t1 = at("2024-01-01T00:10:00.000Z");
	const t2 = at("2024-01-01T00:20:00.000Z");
	const logs = [{ createdAt: t0 }, { createdAt: t1 }, { createdAt: t2 }];

	const state = computeAssignedTaskState(
		{
			cadenceTarget: 2,
			cadenceIntervalMinutes: 60,
			isRecurring: true,
		},
		logs,
		addMinutes(t1, 90),
	);

	expect(state.progress).toBe(1);
	expect(state.isActive).toBe(true);
	expect(state.nextResetAt?.toISOString()).toBe(addMinutes(t1, 60).toISOString());
});

test("recurring tasks activate at the exact reset time", () => {
	const t0 = at("2024-01-01T00:00:00.000Z");
	const t1 = at("2024-01-01T00:10:00.000Z");
	const logs = [{ createdAt: t0 }, { createdAt: t1 }];
	const resetAt = addMinutes(t1, 60);

	const state = computeAssignedTaskState(
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
	expect(state.nextResetAt?.toISOString()).toBe(resetAt.toISOString());
});

test("daily recurring tasks reset at local midnight", () => {
	const completedAt = atLocal(2024, 1, 1, 23, 30);
	const logs = [{ createdAt: completedAt }];
	const beforeReset = atLocal(2024, 1, 1, 23, 45);
	const expectedReset = atLocal(2024, 1, 2, 0, 0);

	const state = computeAssignedTaskState(
		{
			cadenceTarget: 1,
			cadenceIntervalMinutes: 1440,
			isRecurring: true,
		},
		logs,
		beforeReset,
	);

	expect(state.isActive).toBe(false);
	expect(state.nextResetAt?.getTime()).toBe(expectedReset.getTime());
});

test("weekly recurring tasks reset at midnight of the completion day plus 7 days", () => {
	const completedAt = atLocal(2024, 1, 1, 15, 30);
	const logs = [{ createdAt: completedAt }];
	const expectedReset = atLocal(2024, 1, 8, 0, 0);

	const state = computeAssignedTaskState(
		{
			cadenceTarget: 1,
			cadenceIntervalMinutes: 10080, // 7 * 1440
			isRecurring: true,
		},
		logs,
		atLocal(2024, 1, 5, 12, 0),
	);

	expect(state.isActive).toBe(false);
	expect(state.nextResetAt?.getTime()).toBe(expectedReset.getTime());
});

test("handles cadenceTarget of zero by treating it as 1", () => {
	const logs = [{ createdAt: at("2024-01-01T00:00:00.000Z") }];

	const state = computeAssignedTaskState(
		{
			cadenceTarget: 0,
			cadenceIntervalMinutes: 60,
			isRecurring: true,
		},
		logs,
		at("2024-01-01T00:30:00.000Z"),
	);

	expect(state.progress).toBe(1);
	expect(state.isActive).toBe(false);
});

test("handles cadenceIntervalMinutes of zero by treating it as 1", () => {
	const t0 = at("2024-01-01T00:00:00.000Z");
	const logs = [{ createdAt: t0 }];

	const state = computeAssignedTaskState(
		{
			cadenceTarget: 1,
			cadenceIntervalMinutes: 0,
			isRecurring: true,
		},
		logs,
		addMinutes(t0, 2), // 2 minutes later (after 1 minute reset)
	);

	expect(state.isActive).toBe(true);
	expect(state.progress).toBe(0);
	expect(state.nextResetAt?.getTime()).toBe(t0.getTime() + 60_000); // 1 minute later
});

test("handles unsorted logs correctly", () => {
	const t0 = at("2024-01-01T00:00:00.000Z");
	const t1 = at("2024-01-01T00:30:00.000Z");
	const t2 = at("2024-01-01T00:15:00.000Z");
	const logs = [{ createdAt: t1 }, { createdAt: t0 }, { createdAt: t2 }];

	const state = computeAssignedTaskState(
		{
			cadenceTarget: 3,
			cadenceIntervalMinutes: 60,
			isRecurring: true,
		},
		logs,
		at("2024-01-01T00:45:00.000Z"),
	);

	expect(state.progress).toBe(3);
	expect(state.isActive).toBe(false);
	expect(state.nextResetAt?.toISOString()).toBe(addMinutes(t1, 60).toISOString());
});

test("recurring tasks with multiple cadence completions", () => {
	const t0 = at("2024-01-01T00:00:00.000Z");
	const t1 = at("2024-01-01T00:10:00.000Z");
	const t2 = at("2024-01-01T01:30:00.000Z");
	const t3 = at("2024-01-01T01:40:00.000Z");
	const t4 = at("2024-01-01T03:00:00.000Z");
	const logs = [{ createdAt: t0 }, { createdAt: t1 }, { createdAt: t2 }, { createdAt: t3 }, { createdAt: t4 }];

	const state = computeAssignedTaskState(
		{
			cadenceTarget: 2,
			cadenceIntervalMinutes: 60,
			isRecurring: true,
		},
		logs,
		at("2024-01-01T04:00:00.000Z"),
	);

	expect(state.progress).toBe(1);
	expect(state.isActive).toBe(true);
});

test("non-recurring task with logs beyond target counts only up to target", () => {
	const logs = [
		{ createdAt: at("2024-01-01T00:00:00.000Z") },
		{ createdAt: at("2024-01-01T00:10:00.000Z") },
		{ createdAt: at("2024-01-01T00:20:00.000Z") },
		{ createdAt: at("2024-01-01T00:30:00.000Z") },
		{ createdAt: at("2024-01-01T00:40:00.000Z") },
	];

	const state = computeAssignedTaskState(
		{
			cadenceTarget: 3,
			cadenceIntervalMinutes: 60,
			isRecurring: false,
		},
		logs,
		at("2024-01-01T01:00:00.000Z"),
	);

	expect(state.progress).toBe(3);
	expect(state.isActive).toBe(false);
	expect(state.nextResetAt).toBeNull();
});

test("hourly tasks do not reset at day boundaries", () => {
	const completedAt = atLocal(2024, 1, 1, 23, 30);
	const logs = [{ createdAt: completedAt }];
	const afterMidnight = atLocal(2024, 1, 2, 0, 15); // 45 minutes later, before 60-min reset
	const afterReset = atLocal(2024, 1, 2, 0, 35); // 65 minutes later, after reset

	const stateBefore = computeAssignedTaskState(
		{
			cadenceTarget: 1,
			cadenceIntervalMinutes: 60,
			isRecurring: true,
		},
		logs,
		afterMidnight,
	);

	const stateAfter = computeAssignedTaskState(
		{
			cadenceTarget: 1,
			cadenceIntervalMinutes: 60,
			isRecurring: true,
		},
		logs,
		afterReset,
	);

	// Before reset: should be inactive, waiting for 60 minutes to pass
	expect(stateBefore.isActive).toBe(false);
	expect(stateBefore.nextResetAt?.getTime()).toBe(addMinutes(completedAt, 60).getTime());

	// After reset: should be active again
	expect(stateAfter.isActive).toBe(true);
	expect(stateAfter.nextResetAt?.getTime()).toBe(addMinutes(completedAt, 60).getTime());
});

test("monthly recurring tasks reset at midnight (30 days)", () => {
	const completedAt = atLocal(2024, 1, 15, 10, 30);
	const logs = [{ createdAt: completedAt }];
	const expectedReset = atLocal(2024, 2, 14, 0, 0); // 30 days from midnight of completion day

	const state = computeAssignedTaskState(
		{
			cadenceTarget: 1,
			cadenceIntervalMinutes: 43200, // 30 * 1440
			isRecurring: true,
		},
		logs,
		atLocal(2024, 2, 1, 12, 0),
	);

	expect(state.isActive).toBe(false);
	expect(state.nextResetAt?.getTime()).toBe(expectedReset.getTime());
});

test("task becomes active exactly at reset time with progress reset", () => {
	const t0 = at("2024-01-01T00:00:00.000Z");
	const t1 = at("2024-01-01T00:10:00.000Z");
	const t2 = at("2024-01-01T00:20:00.000Z");
	const logs = [{ createdAt: t0 }, { createdAt: t1 }, { createdAt: t2 }];
	const resetTime = addMinutes(t1, 60);

	const state = computeAssignedTaskState(
		{
			cadenceTarget: 2,
			cadenceIntervalMinutes: 60,
			isRecurring: true,
		},
		logs,
		resetTime,
	);

	expect(state.progress).toBe(1);
	expect(state.isActive).toBe(true);
	expect(state.nextResetAt?.toISOString()).toBe(resetTime.toISOString());
});

test("non-recurring task remains active when below target", () => {
	const logs = [{ createdAt: at("2024-01-01T00:00:00.000Z") }];

	const state = computeAssignedTaskState(
		{
			cadenceTarget: 5,
			cadenceIntervalMinutes: 60,
			isRecurring: false,
		},
		logs,
		at("2024-01-01T01:00:00.000Z"),
	);

	expect(state.progress).toBe(1);
	expect(state.isActive).toBe(true);
	expect(state.nextResetAt).toBeNull();
});

test("handles fractional cadence intervals (90 minutes)", () => {
	const t0 = at("2024-01-01T00:00:00.000Z");
	const logs = [{ createdAt: t0 }];

	const state = computeAssignedTaskState(
		{
			cadenceTarget: 1,
			cadenceIntervalMinutes: 90,
			isRecurring: true,
		},
		logs,
		addMinutes(t0, 45),
	);

	expect(state.isActive).toBe(false);
	expect(state.nextResetAt?.toISOString()).toBe(addMinutes(t0, 90).toISOString());
});
