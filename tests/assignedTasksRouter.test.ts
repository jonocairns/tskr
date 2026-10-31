import { execFileSync } from "node:child_process";
import { rmSync } from "node:fs";
import path from "node:path";
import type { AssignedTask, Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { getWeekViewData } from "@/lib/week-view/queries";
import { assignedTasksRouter } from "@/server/routers/assignedTasks";
import { logsRouter } from "@/server/routers/logs";

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
jest.mock("@/lib/i18nServer", () => ({ getServerT: async () => (key: string) => key }));
jest.mock("@/lib/push", () => ({ isPushConfigured: () => false }));

const { directory } = jest.requireMock("@/lib/prisma") as { directory: string };
const householdId = "household";
const context = (userId: string, activeHouseholdId = householdId) => ({
	req: undefined,
	session: { user: { id: userId }, expires: "2099-01-01T00:00:00.000Z" },
	sessionTimestamps: { iat: undefined, lastActivity: undefined },
	household: { id: activeHouseholdId, membership: { requiresApprovalDefault: false } },
});
const manage = assignedTasksRouter.createCaller(context("approver"));
const complete = assignedTasksRouter.createCaller(context("doer"));
const ownLogs = logsRouter.createCaller(context("doer"));
const approval = logsRouter.createCaller(context("approver"));

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
	await prisma.pointLog.deleteMany();
	await prisma.assignedTask.deleteMany();
	await prisma.presetTask.deleteMany();
	await prisma.householdMember.deleteMany();
	await prisma.household.deleteMany();
	await prisma.user.deleteMany();
	await prisma.user.createMany({ data: [{ id: "doer" }, { id: "approver" }, { id: "outsider" }] });
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
	"week-view eligibility includes an out-of-range %s completion",
	async (status) => {
		const task = await makeTask({ cadenceIntervalMinutes: 10080 });
		await makeLog(task, { status, createdAt: new Date("2024-01-07T21:00:00.000Z") }); // Monday 10:00 NZDT
		const result = await getWeekViewData({
			householdId,
			userId: "doer",
			now: new Date("2024-01-08T23:00:00.000Z"), // Tuesday noon NZDT
			range: {
				start: new Date("2024-01-08T11:00:00.000Z"),
				end: new Date("2024-01-09T11:00:00.000Z"),
				labelKey: "custom",
			},
			timeZone: "Pacific/Auckland",
			dateFormat: "DMY",
			timeFormat: "H24",
		});
		expect(result.timeline).toEqual([]);
		expect(result.completedCount).toBe(0);
		expect(result.plannedCount).toBe(0);
	},
);

test("rejected and reverted completions do not suppress week-view planned work", async () => {
	const task = await makeTask({ cadenceIntervalMinutes: 10080, cadenceTarget: 2 });
	const createdAt = new Date("2024-01-07T21:00:00.000Z");
	await makeLog(task, { createdAt, status: "REJECTED" });
	await makeLog(task, { createdAt, revertedAt: new Date() });
	await makeLog(task, { createdAt, status: "PENDING" });
	const result = await getWeekViewData({
		householdId,
		userId: "doer",
		now: new Date("2024-01-08T23:00:00.000Z"),
		range: {
			start: new Date("2024-01-08T11:00:00.000Z"),
			end: new Date("2024-01-09T11:00:00.000Z"),
			labelKey: "custom",
		},
		timeZone: "Pacific/Auckland",
		dateFormat: "DMY",
		timeFormat: "H24",
	});
	expect(result.plannedCount).toBe(1);
	expect(result.timeline[0]).toMatchObject({ type: "planned", remainingCount: 1 });
});

test("retains owner and household checks inside the write transaction", async () => {
	const task = await makeTask();
	await expect(manage.complete({ householdId, id: task.id })).rejects.toMatchObject({ code: "FORBIDDEN" });
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
