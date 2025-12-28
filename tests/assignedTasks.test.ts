import { computeAssignedTaskState } from "../src/lib/assignedTasks";

const at = (iso: string) => new Date(iso);
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
