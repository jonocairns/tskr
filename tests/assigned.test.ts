import { computeAssignedTaskState } from "@/lib/assignedTasks";
import { buildAssignedTaskEntries } from "@/lib/dashboard/assigned";
import { getBucketPoints } from "@/lib/points";

jest.mock("@/lib/assignedTasks", () => ({
	computeAssignedTaskState: jest.fn(),
}));

const mockedComputeAssignedTaskState = computeAssignedTaskState as jest.MockedFunction<typeof computeAssignedTaskState>;

type AssignedTaskRecord = Parameters<typeof buildAssignedTaskEntries>[0][number];

const makeTask = (overrides: Partial<AssignedTaskRecord> = {}): AssignedTaskRecord => ({
	id: "task-1",
	assignedAt: new Date("2024-01-01T00:00:00.000Z"),
	status: "ACTIVE",
	cadenceTarget: 2,
	cadenceIntervalMinutes: 60,
	isRecurring: true,
	preset: { id: "preset-1", label: "Vacuum", bucket: "QUICK" },
	logs: [],
	...overrides,
});

beforeEach(() => {
	mockedComputeAssignedTaskState.mockReset();
});

test("filters non-ACTIVE tasks and tasks without a preset", () => {
	const tasks: AssignedTaskRecord[] = [makeTask({ status: "PAUSED" }), makeTask({ id: "task-2", preset: null })];

	const entries = buildAssignedTaskEntries(tasks);

	expect(entries).toHaveLength(0);
	expect(mockedComputeAssignedTaskState).not.toHaveBeenCalled();
});

test("falls back to QUICK for invalid buckets and returns ISO timestamps", () => {
	mockedComputeAssignedTaskState.mockReturnValue({
		progress: 1,
		isActive: true,
		nextResetAt: null,
	});

	const assignedAt = new Date("2024-02-02T12:34:56.000Z");
	const entries = buildAssignedTaskEntries([
		makeTask({
			assignedAt,
			preset: { id: "preset-2", label: "Custom", bucket: "NOT-A-BUCKET" },
		}),
	]);

	expect(entries).toHaveLength(1);
	expect(entries[0]?.bucket).toBe("QUICK");
	expect(entries[0]?.points).toBe(getBucketPoints("QUICK"));
	expect(entries[0]?.assignedAt).toBe(assignedAt.toISOString());
});

test("returns no entries when the task is inactive", () => {
	mockedComputeAssignedTaskState.mockReturnValue({
		progress: 2,
		isActive: false,
		nextResetAt: new Date("2024-01-01T02:00:00.000Z"),
	});

	const entries = buildAssignedTaskEntries([makeTask()]);

	expect(entries).toHaveLength(0);
});

test("clamps progress to the cadence target", () => {
	mockedComputeAssignedTaskState.mockReturnValue({
		progress: 5,
		isActive: true,
		nextResetAt: null,
	});

	const entries = buildAssignedTaskEntries([makeTask({ cadenceTarget: 2 })]);

	expect(entries).toHaveLength(1);
	expect(entries[0]?.progress).toBe(2);
});
