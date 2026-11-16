import { execFileSync } from "node:child_process";
import { rmSync } from "node:fs";
import path from "node:path";
import type { AssignedTask, Prisma } from "@prisma/client";
import { getDashboardData } from "@/lib/dashboard/queries";
import { prisma } from "@/lib/prisma";
import { broadcastPush, isPushConfigured } from "@/lib/push";
import { getTasksManageData, getTasksTodoData } from "@/lib/tasks/queries";
import { getStartOfWeekInTimeZone } from "@/lib/timeZones";
import { getWeekViewData } from "@/lib/week-view/queries";
import { assignedTasksRouter } from "@/server/routers/assignedTasks";
import { logsRouter } from "@/server/routers/logs";
import { presetsRouter } from "@/server/routers/presets";

// Exercise the production handlers and Prisma queries, substituting only auth,
// translations, push delivery, and an isolated database for this suite.
jest.mock("@/lib/prisma", () => {
	const { mkdtempSync } = jest.requireActual<typeof import("node:fs")>("node:fs");
	const { tmpdir } = jest.requireActual<typeof import("node:os")>("node:os");
	const { join } = jest.requireActual<typeof import("node:path")>("node:path");
	const { PrismaClient } = jest.requireActual<typeof import("@prisma/client")>("@prisma/client");
	const { PrismaBetterSqlite3 } = jest.requireActual<typeof import("@prisma/adapter-better-sqlite3")>(
		"@prisma/adapter-better-sqlite3",
	);
	const directory = mkdtempSync(join(tmpdir(), "tskr-assignment-tests-"));
	return {
		prisma: new PrismaClient({ adapter: new PrismaBetterSqlite3({ url: `file:${join(directory, "test.db")}` }) }),
		directory,
	};
});

jest.mock("@/server/trpc", () => {
	const { initTRPC } = jest.requireActual<typeof import("@trpc/server")>("@trpc/server");
	const t = initTRPC.create();
	const procedure = (schema: import("zod").ZodTypeAny) => t.procedure.input(schema);
	return {
		router: t.router,
		protectedProcedure: t.procedure,
		householdProcedure: procedure,
		approverProcedure: procedure,
	};
});
jest.mock("@/lib/i18nServer", () => ({
	getServerT:
		async () =>
		(key: string, params: Record<string, unknown> = {}) =>
			key.replace(/\{\{(\w+)\}\}/g, (_, name) => String(params[name])),
}));
jest.mock("@/lib/push", () => ({ isPushConfigured: jest.fn(() => false), broadcastPush: jest.fn() }));

const { directory } = jest.requireMock("@/lib/prisma") as { directory: string };
const householdId = "household";
const context = (userId: string, activeHouseholdId = householdId) => ({
	req: undefined,
	session: { user: { id: userId, name: userId === "doer" ? "Sam" : "Alex" }, expires: "2099-01-01T00:00:00.000Z" },
	sessionTimestamps: { iat: undefined, lastActivity: undefined },
	household: { id: activeHouseholdId, membership: { requiresApprovalDefault: false } },
});
const manage = assignedTasksRouter.createCaller(context("approver"));
const complete = assignedTasksRouter.createCaller(context("doer"));
const ownLogs = logsRouter.createCaller(context("doer"));
const approval = logsRouter.createCaller(context("approver"));
const presets = presetsRouter.createCaller(context("approver"));

const makeTask = (overrides: Partial<AssignedTask> = {}) =>
	prisma.assignedTask.create({
		data: {
			householdId,
			presetId: "preset",
			assignedToId: "doer",
			assignedById: "approver",
			assignedAt: new Date("2024-01-01T00:00:00.000Z"),
			cadenceTarget: 1,
			cadenceIntervalMinutes: 1440,
			isRecurring: true,
			...overrides,
		},
	});
const makeLog = (task: AssignedTask, overrides: Partial<Prisma.PointLogUncheckedCreateInput> = {}) =>
	prisma.pointLog.create({
		data: {
			householdId,
			userId: "doer",
			presetId: "preset",
			assignedTaskId: task.id,
			description: "Vacuum",
			points: 3,
			status: "APPROVED",
			...overrides,
		},
	});
const qualifyingCount = (id: string) =>
	prisma.pointLog.count({
		where: { assignedTaskId: id, revertedAt: null, status: { in: ["PENDING", "APPROVED"] } },
	});

beforeAll(() => {
	execFileSync(
		process.execPath,
		[path.join(process.cwd(), "node_modules/prisma/build/index.js"), "migrate", "deploy"],
		{
			cwd: process.cwd(),
			env: { ...process.env, DATABASE_URL: `file:${path.join(directory, "test.db")}` },
			stdio: "pipe",
			timeout: 30_000,
		},
	);
}, 30_000);

beforeEach(async () => {
	jest.mocked(isPushConfigured).mockReturnValue(false);
	jest.mocked(broadcastPush).mockReset();
	await prisma.pointLog.deleteMany();
	await prisma.assignedTask.deleteMany();
	await prisma.presetTask.deleteMany();
	await prisma.householdMember.deleteMany();
	await prisma.household.deleteMany();
	await prisma.user.deleteMany();
	await prisma.user.createMany({
		data: [{ id: "doer", name: "Sam" }, { id: "approver", name: "Alex" }, { id: "outsider" }],
	});
	await prisma.household.create({
		data: { id: householdId, name: "Test", timeZone: "Pacific/Auckland", createdById: "approver" },
	});
	await prisma.householdMember.createMany({
		data: [
			{ householdId, userId: "doer", role: "DOER" },
			{ householdId, userId: "approver", role: "APPROVER" },
		],
	});
	await prisma.presetTask.create({
		data: {
			id: "preset",
			householdId,
			createdById: "approver",
			label: "Vacuum",
			bucket: "QUICK",
			isShared: true,
			approvalOverride: "REQUIRE",
		},
	});
});

afterAll(async () => {
	await prisma.$disconnect();
	rmSync(directory, { recursive: true, force: true });
});

test.each([true, false])("serializes concurrent completions (recurring: %s)", async (isRecurring) => {
	const task = await makeTask({ isRecurring });
	const attempts = await Promise.allSettled([
		complete.complete({ householdId, id: task.id }),
		complete.complete({ householdId, id: task.id }),
	]);
	expect(attempts.map((attempt) => attempt.status).sort()).toEqual(["fulfilled", "rejected"]);
	expect(await qualifyingCount(task.id)).toBe(1);
	const rejected = attempts.find((attempt) => attempt.status === "rejected");
	expect(rejected?.status === "rejected" && rejected.reason.code).toBe("BAD_REQUEST");
});

test("blocks resubmission after a replacement fills the one-off target", async () => {
	const task = await makeTask({ isRecurring: false });
	const original = (await complete.complete({ householdId, id: task.id })).entry;
	await approval.updateStatus({ id: original.id, action: "reject" });
	const replacement = (await complete.complete({ householdId, id: task.id })).entry;
	await expect(ownLogs.updateStatus({ id: original.id, action: "resubmit" })).rejects.toMatchObject({
		code: "BAD_REQUEST",
	});
	expect(await qualifyingCount(task.id)).toBe(1);
	expect((await prisma.pointLog.findUniqueOrThrow({ where: { id: original.id } })).status).toBe("REJECTED");
	await approval.updateStatus({ id: replacement.id, action: "approve" });
	expect((await prisma.assignedTask.findUniqueOrThrow({ where: { id: task.id } })).status).toBe("COMPLETED");
});

test("serializes competing resubmission and replacement completion", async () => {
	const task = await makeTask({ isRecurring: false });
	const original = (await complete.complete({ householdId, id: task.id })).entry;
	await approval.updateStatus({ id: original.id, action: "reject" });
	const attempts = await Promise.allSettled([
		ownLogs.updateStatus({ id: original.id, action: "resubmit" }),
		complete.complete({ householdId, id: task.id }),
	]);
	expect(attempts.filter((attempt) => attempt.status === "fulfilled")).toHaveLength(1);
	expect(await qualifyingCount(task.id)).toBe(1);
});

test("resubmits into the original household-local cadence, independently of today's progress", async () => {
	const task = await makeTask();
	const originalDate = new Date("2024-01-07T10:30:00.000Z"); // Sunday 23:30 NZDT
	const original = await makeLog(task, { status: "REJECTED", createdAt: originalDate });
	await makeLog(task, { createdAt: new Date("2024-01-07T11:00:00.000Z") }); // Monday 00:00 NZDT
	await makeLog(task); // Current cycle is already full, too.
	await ownLogs.updateStatus({ id: original.id, action: "resubmit" });
	expect(await prisma.pointLog.findUniqueOrThrow({ where: { id: original.id } })).toMatchObject({
		status: "PENDING",
		createdAt: originalDate,
	});
	await approval.updateStatus({ id: original.id, action: "reject" });
	await makeLog(task, { createdAt: originalDate });
	await expect(ownLogs.updateStatus({ id: original.id, action: "resubmit" })).rejects.toMatchObject({
		code: "BAD_REQUEST",
	});
});

test("reconciles status when a recurring task with old approved history becomes one-off", async () => {
	const task = await makeTask();
	await makeLog(task, { createdAt: new Date("2024-01-02T00:00:00.000Z") });
	const result = await manage.update({ householdId, id: task.id, isRecurring: false, cadenceTarget: 4 });
	expect(result.assignedTask).toMatchObject({ isRecurring: false, cadenceTarget: 1, status: "COMPLETED" });
	await expect(complete.complete({ householdId, id: task.id })).rejects.toMatchObject({ code: "BAD_REQUEST" });
	const recurring = await manage.update({ householdId, id: task.id, isRecurring: true });
	expect(recurring.assignedTask.status).toBe("ACTIVE");
	expect(await prisma.pointLog.count({ where: { assignedTaskId: task.id } })).toBe(1);
});

test("pending conversion stays active until approval, then reversion reopens it", async () => {
	const task = await makeTask();
	const log = await makeLog(task, { status: "PENDING" });
	const converted = await manage.update({ householdId, id: task.id, isRecurring: false });
	expect(converted.assignedTask.status).toBe("ACTIVE");
	await expect(complete.complete({ householdId, id: task.id })).rejects.toMatchObject({ code: "BAD_REQUEST" });
	await approval.updateStatus({ id: log.id, action: "approve" });
	expect((await prisma.assignedTask.findUniqueOrThrow({ where: { id: task.id } })).status).toBe("COMPLETED");
	await ownLogs.updateStatus({ id: log.id, action: "revert" });
	expect((await prisma.assignedTask.findUniqueOrThrow({ where: { id: task.id } })).status).toBe("ACTIVE");
	await expect(complete.complete({ householdId, id: task.id })).resolves.toMatchObject({
		entry: { status: "PENDING" },
	});
});

test("keeps one-off targets normalized on partial updates", async () => {
	const task = await makeTask({ isRecurring: false });
	const result = await manage.update({ householdId, id: task.id, cadenceTarget: 9 });
	expect(result.assignedTask.cadenceTarget).toBe(1);
});

test.each(["PENDING", "APPROVED"] as const)(
	"To do eligibility includes every household member's %s completions outside the Done range",
	async (status) => {
		const task = await makeTask({ cadenceIntervalMinutes: 10080 });
		await makeLog(task, { userId: "approver", status, createdAt: new Date("2024-01-07T21:00:00.000Z") });
		const result = await getTasksTodoData({
			householdId,
			actingUserId: "doer",
			userId: "doer",
			now: new Date("2024-01-08T23:00:00.000Z"),
			timeZone: "Pacific/Auckland",
		});
		if (status === "APPROVED") expect(result).toEqual([]);
		else
			expect(result).toMatchObject([
				{ id: task.id, state: "awaitingApproval", progress: 1, pendingCompleters: ["Alex"] },
			]);
	},
);

test("rejected and reverted completions do not suppress To do work", async () => {
	const task = await makeTask({ cadenceIntervalMinutes: 10080, cadenceTarget: 2 });
	const createdAt = new Date("2024-01-07T21:00:00.000Z");
	await makeLog(task, { createdAt, status: "REJECTED" });
	await makeLog(task, { createdAt, revertedAt: new Date() });
	await makeLog(task, { createdAt, status: "PENDING" });
	const result = await getTasksTodoData({
		householdId,
		actingUserId: "doer",
		userId: "doer",
		now: new Date("2024-01-08T23:00:00.000Z"),
		timeZone: "Pacific/Auckland",
	});
	expect(result).toMatchObject([{ id: task.id, state: "available", progress: 1, cadenceTarget: 2 }]);
});

test.each(["doer", "approver", "all"])(
	"Tasks filter %s includes Open tasks in To do and filters Done by completer",
	async (userId) => {
		const mine = await makeTask({ cadenceTarget: 2 });
		const theirs = await makeTask({ assignedToId: "approver", cadenceTarget: 2 });
		const open = await makeTask({ assignedToId: null, cadenceTarget: 2 });
		const now = new Date("2024-01-08T23:00:00.000Z");
		const myLog = await makeLog(theirs, { createdAt: now });
		const theirLog = await makeLog(mine, { userId: "approver", createdAt: now, status: "PENDING" });
		const openLog = await makeLog(open, { userId: "approver", createdAt: now });
		const result = await getWeekViewData({
			householdId,
			userId,
			range: {
				start: new Date("2024-01-07T11:00:00.000Z"),
				end: new Date("2024-01-14T11:00:00.000Z"),
				labelKey: "calendarWeek",
			},
			timeZone: "Pacific/Auckland",
			dateFormat: "DMY",
			timeFormat: "H24",
		});
		const todos = await getTasksTodoData({
			householdId,
			actingUserId: "doer",
			userId,
			now,
			timeZone: "Pacific/Auckland",
		});
		const done = result.timeline.filter((entry) => entry.type === "completed");
		const expectedTaskIds =
			userId === "all" ? [mine.id, theirs.id, open.id] : [userId === "doer" ? mine.id : theirs.id, open.id];
		const expectedLogIds =
			userId === "all"
				? [myLog.id, theirLog.id, openLog.id]
				: userId === "doer"
					? [myLog.id]
					: [theirLog.id, openLog.id];
		expect(todos.map((entry) => entry.id).sort()).toEqual(expectedTaskIds.sort());
		expect(done.map((entry) => entry.id).sort()).toEqual(expectedLogIds.sort());
		// Other members' completions still consume capacity when their logs are filtered out.
		expect(todos.every((entry) => entry.progress === 1 && entry.state === "available")).toBe(true);
		expect(todos.find((entry) => entry.id === open.id)?.group).toBe("open");
		if (userId === "all") {
			expect(todos.find((entry) => entry.id === mine.id)).toMatchObject({ group: "mine", assigneeLabel: "Sam" });
			expect(todos.find((entry) => entry.id === theirs.id)?.group).toBe("others");
			expect(done.find((entry) => entry.id === myLog.id)).toMatchObject({
				assignedTo: { id: "approver", name: "Alex" },
				completedBy: { id: "doer", name: "Sam" },
			});
			expect(done.find((entry) => entry.id === openLog.id)).toMatchObject({
				assignedTo: null,
				completedBy: { id: "approver", name: "Alex" },
			});
		}
	},
);

test("Done includes ad-hoc PRESET and TIMED completions with the same range/status rules", async () => {
	const now = new Date("2024-01-08T23:00:00.000Z");
	const quickLog = (data: Partial<Prisma.PointLogUncheckedCreateInput>) =>
		prisma.pointLog.create({
			data: {
				householdId,
				userId: "doer",
				description: "Quick completion",
				points: 3,
				kind: "PRESET",
				status: "APPROVED",
				createdAt: now,
				...data,
			},
		});
	const preset = await quickLog({});
	const timed = await quickLog({ kind: "TIMED", status: "PENDING" });
	await quickLog({ status: "REJECTED" });
	await quickLog({ revertedAt: now });
	await quickLog({ kind: "REWARD" });
	await quickLog({ createdAt: new Date("2024-01-07T10:59:59.999Z") });
	await quickLog({ createdAt: new Date("2024-01-14T11:00:00.000Z") });
	await quickLog({ userId: "approver" });
	const result = await getWeekViewData({
		householdId,
		userId: "doer",
		timeZone: "Pacific/Auckland",
		dateFormat: "DMY",
		timeFormat: "H24",
		range: {
			start: new Date("2024-01-07T11:00:00.000Z"),
			end: new Date("2024-01-14T11:00:00.000Z"),
			labelKey: "calendarWeek",
		},
	});
	expect(result.timeline.map((entry) => entry.id).sort()).toEqual([preset.id, timed.id].sort());
	expect(result.timeline.every((entry) => entry.assignedTaskId === null)).toBe(true);
	expect(result).toMatchObject({ completedCount: 2, pendingCount: 1, approvedPoints: 3 });
});

test("retains membership and household checks inside the write transaction", async () => {
	const task = await makeTask();
	await expect(
		assignedTasksRouter.createCaller(context("outsider")).complete({ householdId, id: task.id }),
	).rejects.toMatchObject({ code: "FORBIDDEN" });
	await expect(
		assignedTasksRouter
			.createCaller(context("approver", "other-house"))
			.update({ householdId: "other-house", id: task.id, isRecurring: false }),
	).rejects.toMatchObject({ code: "NOT_FOUND" });
	const log = await makeLog(task, { status: "PENDING" });
	await expect(ownLogs.updateStatus({ id: log.id, action: "approve" })).rejects.toMatchObject({ code: "FORBIDDEN" });
	await expect(
		logsRouter.createCaller(context("outsider")).updateStatus({ id: log.id, action: "approve" }),
	).rejects.toMatchObject({ code: "NOT_FOUND" });
	expect((await prisma.pointLog.findUniqueOrThrow({ where: { id: log.id } })).status).toBe("PENDING");
});

test.each([
	{ override: "SKIP" as const, requiresApprovalDefault: true, expected: "APPROVED" },
	{ override: null, requiresApprovalDefault: true, expected: "PENDING" },
	{ override: null, requiresApprovalDefault: false, expected: "APPROVED" },
])(
	"preserves approval settings on atomic completion: $override / $requiresApprovalDefault",
	async ({ override, requiresApprovalDefault, expected }) => {
		await prisma.presetTask.update({ where: { id: "preset" }, data: { approvalOverride: override } });
		await prisma.householdMember.update({
			where: { householdId_userId: { householdId, userId: "doer" } },
			data: { requiresApprovalDefault },
		});
		const task = await makeTask({ isRecurring: false });
		const result = await complete.complete({ householdId, id: task.id });
		expect(result.entry.status).toBe(expected);
		expect((await prisma.assignedTask.findUniqueOrThrow({ where: { id: task.id } })).status).toBe(
			expected === "APPROVED" ? "COMPLETED" : "ACTIVE",
		);
	},
);

test("serializes approval and rejection of the same pending completion", async () => {
	const task = await makeTask({ isRecurring: false });
	const log = await makeLog(task, { status: "PENDING" });
	const attempts = await Promise.allSettled([
		approval.updateStatus({ id: log.id, action: "approve" }),
		approval.updateStatus({ id: log.id, action: "reject" }),
	]);
	expect(attempts.filter((attempt) => attempt.status === "fulfilled")).toHaveLength(1);
	const savedLog = await prisma.pointLog.findUniqueOrThrow({ where: { id: log.id } });
	const savedTask = await prisma.assignedTask.findUniqueOrThrow({ where: { id: task.id } });
	expect(savedTask.status).toBe(savedLog.status === "APPROVED" ? "COMPLETED" : "ACTIVE");
});

test("a non-assignee member completes using their own points and approval default", async () => {
	await prisma.presetTask.update({ where: { id: "preset" }, data: { approvalOverride: null } });
	await prisma.householdMember.update({
		where: { householdId_userId: { householdId, userId: "doer" } },
		data: { requiresApprovalDefault: true },
	});
	const task = await makeTask({ assignedToId: "approver", isRecurring: false });
	const { entry } = await complete.complete({ householdId, id: task.id });
	expect(entry).toMatchObject({ userId: "doer", assignedTaskId: task.id, points: 3, status: "PENDING" });
	expect(await prisma.pointLog.findUniqueOrThrow({ where: { id: entry.id } })).toEqual(entry);
	expect(broadcastPush).not.toHaveBeenCalled();
});

test("an Open task can be completed", async () => {
	const task = await makeTask({ assignedToId: null });
	await expect(complete.complete({ householdId, id: task.id })).resolves.toMatchObject({
		entry: { userId: "doer", assignedTaskId: task.id },
	});
});

test.each(["REQUIRE", "SKIP"] as const)("another member's %s completion consumes task capacity", async (override) => {
	await prisma.presetTask.update({ where: { id: "preset" }, data: { approvalOverride: override } });
	const task = await makeTask();
	const { entry } = await manage.complete({ householdId, id: task.id });
	expect(entry).toMatchObject({ userId: "approver", status: override === "REQUIRE" ? "PENDING" : "APPROVED" });
	await expect(complete.complete({ householdId, id: task.id })).rejects.toMatchObject({ code: "BAD_REQUEST" });
	expect(await qualifyingCount(task.id)).toBe(1);
});

test("creates Open tasks, reassigns and unassigns without changing omitted assignees", async () => {
	const input = { householdId, presetId: "preset", cadenceTarget: 1, cadenceIntervalMinutes: 1440, isRecurring: true };
	for (const assignment of [{ assigneeId: null }, {}]) {
		const { assignedTask } = await manage.create({ ...input, ...assignment });
		expect(assignedTask).toMatchObject({ assignedToId: null, assignedById: "approver" });
	}
	const { assignedTask: task } = await manage.create({ ...input, assigneeId: "doer" });
	expect(task.assignedToId).toBe("doer");
	await expect(manage.update({ householdId, id: task.id, assigneeId: "approver" })).resolves.toMatchObject({
		assignedTask: { assignedToId: "approver" },
	});
	await expect(manage.update({ householdId, id: task.id, cadenceTarget: 2 })).resolves.toMatchObject({
		assignedTask: { assignedToId: "approver" },
	});
	await expect(manage.update({ householdId, id: task.id, assigneeId: null })).resolves.toMatchObject({
		assignedTask: { assignedToId: null },
	});
	await expect(manage.update({ householdId, id: task.id, assigneeId: "doer" })).resolves.toMatchObject({
		assignedTask: { assignedToId: "doer" },
	});
	await expect(manage.update({ householdId, id: task.id, assigneeId: "outsider" })).rejects.toMatchObject({
		code: "BAD_REQUEST",
	});
	expect((await prisma.assignedTask.findUniqueOrThrow({ where: { id: task.id } })).assignedToId).toBe("doer");
	await expect(manage.create({ ...input, assigneeId: "outsider" })).rejects.toMatchObject({ code: "BAD_REQUEST" });
});

test("rejects personal presets for new tasks while retaining existing task completions", async () => {
	await prisma.presetTask.update({ where: { id: "preset" }, data: { isShared: false } });
	await expect(
		manage.create({
			householdId,
			presetId: "preset",
			assigneeId: null,
			cadenceTarget: 1,
			cadenceIntervalMinutes: 1440,
			isRecurring: false,
		}),
	).rejects.toMatchObject({ code: "BAD_REQUEST", message: "Only shared tasks can be added to the list" });
	const task = await makeTask();
	await expect(manage.complete({ householdId, id: task.id })).resolves.toMatchObject({ entry: { userId: "approver" } });
});

test("blocks un-sharing while active tasks use a preset and returns only household active usage", async () => {
	const assigned = await makeTask();
	const open = await makeTask({ assignedToId: null });
	await makeTask({ status: "COMPLETED" });
	await expect(presets.update({ householdId, id: "preset", isShared: false })).rejects.toMatchObject({
		code: "BAD_REQUEST",
		message: "Cannot make this task personal while it is on the household task list",
	});
	expect((await prisma.presetTask.findUniqueOrThrow({ where: { id: "preset" } })).isShared).toBe(true);
	const { tasks } = await presets.usage({ householdId, id: "preset" });
	expect(tasks).toHaveLength(2);
	expect(tasks).toEqual(
		expect.arrayContaining([
			{ id: assigned.id, preset: { label: "Vacuum" }, assignedTo: { name: "Sam", email: null } },
			{ id: open.id, preset: { label: "Vacuum" }, assignedTo: null },
		]),
	);
	await expect(
		presetsRouter.createCaller(context("approver", "other-house")).usage({ householdId: "other-house", id: "preset" }),
	).resolves.toEqual({ tasks: [] });
	await prisma.assignedTask.updateMany({ data: { status: "COMPLETED" } });
	await expect(presets.update({ householdId, id: "preset", isShared: false })).resolves.toMatchObject({
		preset: { isShared: false },
	});
});

test("deleting an assignee unassigns tasks and deleting their creator retains them", async () => {
	// Keep household/preset ownership separate: their existing cascades still apply.
	const task = await makeTask({ assignedById: "outsider" });
	const log = await makeLog(task, { userId: "approver" });
	await prisma.user.delete({ where: { id: "doer" } });
	expect(await prisma.assignedTask.findUniqueOrThrow({ where: { id: task.id } })).toMatchObject({
		assignedToId: null,
		assignedById: "outsider",
	});
	await prisma.user.delete({ where: { id: "outsider" } });
	expect(await prisma.assignedTask.findUniqueOrThrow({ where: { id: task.id } })).toMatchObject({
		assignedToId: null,
		assignedById: null,
	});
	expect((await prisma.pointLog.findUniqueOrThrow({ where: { id: log.id } })).assignedTaskId).toBe(task.id);
});

test.each([
	{ assigneeId: "doer", override: "REQUIRE", body: "Alex completed Sam's Vacuum, awaiting approval" },
	{ assigneeId: "doer", override: "SKIP", body: "Alex completed Sam's Vacuum" },
	{ assigneeId: "approver", override: "REQUIRE", body: "Alex completed Vacuum, awaiting approval" },
	{ assigneeId: "approver", override: "SKIP", body: "Alex completed Vacuum" },
	{ assigneeId: null, override: "REQUIRE", body: "Alex completed Vacuum, awaiting approval" },
	{ assigneeId: null, override: "SKIP", body: "Alex completed Vacuum" },
] as const)("pushes after commit: $body", async ({ assigneeId, override, body }) => {
	jest.mocked(isPushConfigured).mockReturnValue(true);
	await prisma.presetTask.update({ where: { id: "preset" }, data: { approvalOverride: override } });
	const task = await makeTask({ assignedToId: assigneeId, isRecurring: false });
	let committedState: { count: number; status: string } | undefined;
	jest.mocked(broadcastPush).mockImplementationOnce(async () => {
		// A separate connection observes the completed transaction before delivery.
		const { PrismaClient } = jest.requireActual<typeof import("@prisma/client")>("@prisma/client");
		const { PrismaBetterSqlite3 } = jest.requireActual<typeof import("@prisma/adapter-better-sqlite3")>(
			"@prisma/adapter-better-sqlite3",
		);
		const reader = new PrismaClient({
			adapter: new PrismaBetterSqlite3({ url: `file:${path.join(directory, "test.db")}` }),
		});
		try {
			committedState = {
				count: await reader.pointLog.count({ where: { assignedTaskId: task.id } }),
				status: (await reader.assignedTask.findUniqueOrThrow({ where: { id: task.id } })).status,
			};
		} finally {
			await reader.$disconnect();
		}
		return { sent: 1, removed: 0 };
	});
	await manage.complete({ householdId, id: task.id });
	expect(committedState).toEqual({ count: 1, status: override === "SKIP" ? "COMPLETED" : "ACTIVE" });
	expect(broadcastPush).toHaveBeenCalledWith(expect.objectContaining({ title: "Task completed", body }), {
		householdId,
		excludeUserId: "approver",
	});
	await expect(manage.complete({ householdId, id: task.id })).rejects.toMatchObject({ code: "BAD_REQUEST" });
	expect(broadcastPush).toHaveBeenCalledTimes(1);
});

test("push errors do not undo or fail a committed completion", async () => {
	jest.mocked(isPushConfigured).mockReturnValue(true);
	const error = new Error("Delivery failed");
	jest.mocked(broadcastPush).mockRejectedValueOnce(error);
	const logged = jest.spyOn(console, "error").mockImplementation(() => {});
	try {
		const task = await makeTask();
		await expect(manage.complete({ householdId, id: task.id })).resolves.toMatchObject({
			entry: { userId: "approver" },
		});
		expect(await qualifyingCount(task.id)).toBe(1);
		expect(logged).toHaveBeenCalledWith("[push] notify failed", error);
	} finally {
		logged.mockRestore();
	}
});

test("dashboard loads every active household task and counts only household task logs since the local Monday", async () => {
	const mine = await makeTask();
	const other = await makeTask({ assignedToId: "approver" });
	const open = await makeTask({ assignedToId: null });
	await prisma.presetTask.update({ where: { id: "preset" }, data: { isShared: false } });
	const weekStart = getStartOfWeekInTimeZone(new Date(), "Pacific/Auckland");
	const unlinked = { assignedTaskId: null, createdAt: weekStart };
	await makeLog(mine, { ...unlinked, status: "PENDING", userId: "approver" });
	await makeLog(mine, { ...unlinked, status: "APPROVED", kind: "TIMED" });
	await makeLog(mine, { ...unlinked, createdAt: new Date(weekStart.getTime() - 1) });
	await makeLog(mine, { ...unlinked, revertedAt: new Date() });
	await makeLog(mine, { ...unlinked, status: "REJECTED" });
	await makeLog(mine, { ...unlinked, kind: "REWARD" });
	await prisma.household.create({ data: { id: "other-house", name: "Other", createdById: "outsider" } });
	await makeLog(mine, { ...unlinked, householdId: "other-house", presetId: null, userId: "outsider" });

	const dashboard = await getDashboardData("doer", householdId);
	expect(dashboard.householdDoneThisWeek).toBe(2);
	expect(dashboard.hasActiveAssignedTasks).toBe(true);
	expect(dashboard.assignedTasks).toHaveLength(3);
	expect(dashboard.assignedTasks).toEqual(
		expect.arrayContaining([
			expect.objectContaining({ id: mine.id, group: "mine", assigneeLabel: "Sam" }),
			expect.objectContaining({ id: other.id, group: "others", assigneeLabel: "Alex" }),
			expect.objectContaining({ id: open.id, group: "open", assigneeLabel: null }),
		]),
	);
});

test("removing archives a task, excludes current usage, and preserves Done provenance and weekly counts", async () => {
	const task = await makeTask({ cadenceTarget: 2 });
	const log = await makeLog(task);
	await expect(manage.delete({ householdId, id: task.id })).resolves.toEqual({ ok: true });
	const saved = await prisma.assignedTask.findUniqueOrThrow({ where: { id: task.id } });
	expect(saved.archivedAt).toBeInstanceOf(Date);
	expect((await prisma.pointLog.findUniqueOrThrow({ where: { id: log.id } })).assignedTaskId).toBe(task.id);
	const query = { householdId, userId: "all", timeZone: "Pacific/Auckland" };
	expect(await getTasksTodoData({ ...query, actingUserId: "approver" })).toEqual([]);
	expect((await getTasksManageData({ ...query, userId: "approver" })).tasks).toEqual([]);
	const dashboard = await getDashboardData("doer", householdId);
	expect(dashboard.assignedTasks).toEqual([]);
	expect(dashboard.hasActiveAssignedTasks).toBe(false);
	expect(dashboard.householdDoneThisWeek).toBe(1);
	expect(await presets.usage({ householdId, id: "preset" })).toEqual({ tasks: [] });
	await expect(presets.update({ householdId, id: "preset", isShared: false })).resolves.toMatchObject({
		preset: { isShared: false },
	});
	const done = await getWeekViewData({
		...query,
		range: {
			start: new Date(log.createdAt.getTime() - 1),
			end: new Date(log.createdAt.getTime() + 1),
			labelKey: "calendarWeek",
		},
		dateFormat: "DMY",
		timeFormat: "H24",
	});
	expect(done.timeline).toMatchObject([
		{
			id: log.id,
			description: "Vacuum",
			assignedTaskId: task.id,
			assignedTo: { id: "doer", name: "Sam" },
		},
	]);
});

test("archived tasks reject completion, edits and repeated removal", async () => {
	const task = await makeTask();
	await manage.delete({ householdId, id: task.id });
	await expect(complete.complete({ householdId, id: task.id })).rejects.toMatchObject({
		code: "NOT_FOUND",
		message: "Task not found",
	});
	await expect(manage.update({ householdId, id: task.id, cadenceTarget: 3 })).rejects.toMatchObject({
		code: "NOT_FOUND",
		message: "Task not found",
	});
	await expect(manage.delete({ householdId, id: task.id })).rejects.toMatchObject({
		code: "NOT_FOUND",
		message: "Task not found",
	});
	expect(await prisma.pointLog.count()).toBe(0);
});

test.each(["approve", "reject", "revert"] as const)(
	"%s on an archived task's pending log keeps it archived",
	async (action) => {
		const task = await makeTask({ isRecurring: false });
		const log = await makeLog(task, { status: "PENDING" });
		await manage.delete({ householdId, id: task.id });
		const archived = await prisma.assignedTask.findUniqueOrThrow({ where: { id: task.id } });
		await approval.updateStatus({ id: log.id, action });
		if (action === "reject") {
			await ownLogs.updateStatus({ id: log.id, action: "resubmit" });
			await approval.updateStatus({ id: log.id, action: "approve" });
		}
		if (action !== "revert") await ownLogs.updateStatus({ id: log.id, action: "revert" });
		expect((await prisma.assignedTask.findUniqueOrThrow({ where: { id: task.id } })).archivedAt).toEqual(
			archived.archivedAt,
		);
		expect((await getDashboardData("doer", householdId)).hasActiveAssignedTasks).toBe(false);
		expect((await prisma.pointLog.findUniqueOrThrow({ where: { id: log.id } })).assignedTaskId).toBe(task.id);
	},
);

const quickLog = (options: { assignedTaskId?: string; asExtra?: boolean } = {}) =>
	ownLogs.create({ householdId, type: "preset", presetId: "preset", ...options });

test("Quick log uses the same completion fields and approval override as To do", async () => {
	const task = await makeTask({ cadenceTarget: 2 });
	const tapped = await quickLog();
	const completed = await complete.complete({ householdId, id: task.id });
	expect(tapped.outcome).toBe("logged");
	if (tapped.outcome !== "logged") throw new Error("Expected log");
	expect(tapped.countedTowards).toEqual({ id: task.id, label: "Vacuum", assigneeName: "Sam" });
	for (const key of ["points", "status", "assignedTaskId", "duration", "presetId", "kind", "description"] as const) {
		expect(tapped.entry[key]).toEqual(completed.entry[key]);
	}
	expect(tapped.entry.status).toBe("PENDING");
});

test("Quick log prioritizes own, then Open, before another member's task", async () => {
	await makeTask({ assignedToId: "approver" });
	const open = await makeTask({ assignedToId: null });
	const mine = await makeTask();
	const first = await quickLog();
	const second = await quickLog();
	expect(first).toMatchObject({ outcome: "logged", entry: { assignedTaskId: mine.id } });
	expect(second).toMatchObject({ outcome: "logged", entry: { assignedTaskId: open.id } });
	expect(await quickLog()).toMatchObject({ outcome: "needsConfirmation" });
});

test("Quick log chooses the oldest Open task, breaking ties by id", async () => {
	// The later-assigned task has the smallest id, so only assignedAt ordering can pick "a".
	await makeTask({ id: "0", assignedToId: null, assignedAt: new Date("2024-02-01") });
	await makeTask({ id: "b", assignedToId: null });
	const first = await makeTask({ id: "a", assignedToId: null });
	expect(await quickLog()).toMatchObject({ outcome: "logged", entry: { assignedTaskId: first.id } });
});

test("Quick log tiers outrank age, and a full own task falls through to Open", async () => {
	const open = await makeTask({ assignedToId: null, assignedAt: new Date("2023-01-01") });
	const mine = await makeTask({ assignedAt: new Date("2024-01-01") });
	expect(await quickLog()).toMatchObject({ outcome: "logged", entry: { assignedTaskId: mine.id } });
	expect(await quickLog()).toMatchObject({ outcome: "logged", entry: { assignedTaskId: open.id } });
});

test("a confirmation for a task archived in between is rejected without writing", async () => {
	const task = await makeTask({ assignedToId: "approver" });
	expect(await quickLog()).toMatchObject({ outcome: "needsConfirmation" });
	await manage.delete({ householdId, id: task.id });
	await expect(quickLog({ assignedTaskId: task.id })).rejects.toMatchObject({
		code: "BAD_REQUEST",
		message: "Task is not active",
	});
	expect(await prisma.pointLog.count()).toBe(0);
});

test("another member's match reserves nothing; explicit confirmation and extra are respected", async () => {
	const task = await makeTask({ assignedToId: "approver" });
	jest.mocked(isPushConfigured).mockReturnValue(true);
	expect(await quickLog()).toEqual({
		outcome: "needsConfirmation",
		task: { id: task.id, label: "Vacuum", assigneeName: "Alex" },
	});
	expect(await prisma.pointLog.count()).toBe(0);
	expect(broadcastPush).not.toHaveBeenCalled();
	expect(await quickLog({ asExtra: true })).toMatchObject({
		outcome: "logged",
		entry: { assignedTaskId: null },
		countedTowards: null,
	});
	expect(await quickLog({ assignedTaskId: task.id })).toMatchObject({
		outcome: "logged",
		entry: { assignedTaskId: task.id },
	});
});

test.each(["APPROVED", "PENDING", "archived", "COMPLETED", "future"] as const)(
	"Quick log falls back to extra for a %s task",
	async (state) => {
		const task = await makeTask({
			...(state === "archived" ? { archivedAt: new Date() } : {}),
			...(state === "COMPLETED" ? { status: "COMPLETED" } : {}),
			...(state === "future" ? { assignedAt: new Date("2099-01-01") } : {}),
		});
		if (state === "APPROVED" || state === "PENDING") await makeLog(task, { status: state });
		expect(await quickLog()).toMatchObject({
			outcome: "logged",
			entry: { assignedTaskId: null },
			countedTowards: null,
		});
	},
);

test("concurrent Quick logs both succeed but only one fills the listed task", async () => {
	const task = await makeTask();
	const results = await Promise.all([quickLog(), quickLog()]);
	expect(
		results.filter((result) => result.outcome === "logged" && result.entry.assignedTaskId === task.id),
	).toHaveLength(1);
	expect(await qualifyingCount(task.id)).toBe(1);
	expect(await prisma.pointLog.count()).toBe(2);
});

test("Quick log and To do serialize their capacity checks", async () => {
	const task = await makeTask();
	await Promise.allSettled([quickLog(), complete.complete({ householdId, id: task.id })]);
	expect(await qualifyingCount(task.id)).toBe(1);
});

test("stale explicit confirmation never silently falls back to extra", async () => {
	const task = await makeTask({ assignedToId: "approver" });
	await quickLog();
	await complete.complete({ householdId, id: task.id });
	const written = await prisma.pointLog.count();
	await expect(quickLog({ assignedTaskId: task.id })).rejects.toMatchObject({ code: "BAD_REQUEST" });
	expect(await prisma.pointLog.count()).toBe(written);
});

test("approved one-off Quick log completes, undo reopens, and the next tap matches", async () => {
	await prisma.presetTask.update({ where: { id: "preset" }, data: { approvalOverride: "SKIP" } });
	const task = await makeTask({ isRecurring: false });
	const result = await quickLog();
	if (result.outcome !== "logged") throw new Error("Expected log");
	expect((await prisma.assignedTask.findUniqueOrThrow({ where: { id: task.id } })).status).toBe("COMPLETED");
	await ownLogs.updateStatus({ id: result.entry.id, action: "revert" });
	expect((await prisma.assignedTask.findUniqueOrThrow({ where: { id: task.id } })).status).toBe("ACTIVE");
	expect(await quickLog()).toMatchObject({ outcome: "logged", entry: { assignedTaskId: task.id } });
});

test("personal presets, timed work, and built-in preset keys never match", async () => {
	const task = await makeTask();
	await prisma.presetTask.update({ where: { id: "preset" }, data: { isShared: false, createdById: "doer" } });
	expect(await quickLog()).toMatchObject({ outcome: "logged", countedTowards: null, entry: { assignedTaskId: null } });
	expect(await ownLogs.create({ householdId, type: "timed", bucket: "QUICK", description: "Vacuum" })).toMatchObject({
		outcome: "logged",
		countedTowards: null,
		entry: { assignedTaskId: null },
	});
	const { PRESET_TASKS } = await import("@/lib/points");
	expect(await ownLogs.create({ householdId, type: "preset", presetKey: PRESET_TASKS[0].key })).toMatchObject({
		outcome: "logged",
		countedTowards: null,
		entry: { assignedTaskId: null },
	});
	expect(await qualifyingCount(task.id)).toBe(0);
	await expect(quickLog({ assignedTaskId: task.id })).rejects.toMatchObject({ code: "BAD_REQUEST" });
});

test.each([false, true])("Quick log pushes after commit and tolerates push failure (%s)", async (fail) => {
	const task = await makeTask();
	jest.mocked(isPushConfigured).mockReturnValue(true);
	let committedCount: number | undefined;
	jest.mocked(broadcastPush).mockImplementation(async () => {
		const { PrismaClient } = jest.requireActual<typeof import("@prisma/client")>("@prisma/client");
		const { PrismaBetterSqlite3 } = jest.requireActual<typeof import("@prisma/adapter-better-sqlite3")>(
			"@prisma/adapter-better-sqlite3",
		);
		const reader = new PrismaClient({
			adapter: new PrismaBetterSqlite3({ url: `file:${path.join(directory, "test.db")}` }),
		});
		try {
			committedCount = await reader.pointLog.count({ where: { assignedTaskId: task.id } });
		} finally {
			await reader.$disconnect();
		}
		if (fail) throw new Error("Push unavailable");
		return { sent: 1, removed: 0 };
	});
	const error = jest.spyOn(console, "error").mockImplementation(() => {});
	try {
		expect(await quickLog()).toMatchObject({ outcome: "logged", entry: { assignedTaskId: task.id } });
		expect(committedCount).toBe(1);
		expect(broadcastPush).toHaveBeenCalledWith(expect.objectContaining({ title: "Task completed" }), {
			householdId,
			excludeUserId: "doer",
		});
		if (fail) expect(error).toHaveBeenCalledWith("[push] notify failed", expect.any(Error));
	} finally {
		error.mockRestore();
	}
});

test("matching options require presetId and reject conflicting instructions", async () => {
	await expect(quickLog({ asExtra: true, assignedTaskId: "task" })).rejects.toMatchObject({ code: "BAD_REQUEST" });
	await expect(ownLogs.create({ householdId, type: "preset", presetKey: "bins", asExtra: true })).rejects.toMatchObject(
		{ code: "BAD_REQUEST" },
	);
	expect(await prisma.pointLog.count()).toBe(0);
});
