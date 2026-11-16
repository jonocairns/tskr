jest.mock("@/lib/prisma", () => ({
	get prisma() {
		return mockPrisma;
	},
}));
jest.mock("@/lib/auth", () => ({ getAuthSession: jest.fn() }));
jest.mock("superjson", () => ({
	__esModule: true,
	default: { serialize: (value: unknown) => value, deserialize: (value: unknown) => value },
}));

import { execFileSync } from "node:child_process";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { PrismaBetterSqlite3 } from "@prisma/adapter-better-sqlite3";
import { PrismaClient } from "@prisma/client";
import { assignedTasksRouter } from "@/server/routers/assignedTasks";
import { presetsRouter } from "@/server/routers/presets";

// Runs through the real tRPC middleware so membership and approver checks are exercised.
const directory = mkdtempSync(join(tmpdir(), "tskr-create-with-preset-"));
const databaseUrl = `file:${join(directory, "test.db")}`;
const mockPrisma = new PrismaClient({ adapter: new PrismaBetterSqlite3({ url: databaseUrl }) });

const householdId = "home";
const callerContext = (userId: string) => ({
	req: undefined,
	session: { user: { id: userId }, expires: new Date(Date.now() + 60000).toISOString() },
	sessionTimestamps: { iat: Math.floor(Date.now() / 1000), lastActivity: Math.floor(Date.now() / 1000) },
});
const assignments = (userId: string) => assignedTasksRouter.createCaller(callerContext(userId));
const input = (overrides: Record<string, unknown> = {}) => ({
	householdId,
	preset: {
		label: "  Water plants  ",
		bucket: "ROUTINE" as const,
		iconKey: null,
		approvalOverride: "REQUIRE" as const,
	},
	assigneeId: "doer",
	cadenceTarget: 2,
	cadenceIntervalMinutes: 10080,
	isRecurring: true,
	...overrides,
});

beforeAll(() => {
	execFileSync(process.execPath, [require.resolve("prisma/build/index.js"), "migrate", "deploy"], {
		env: { ...process.env, DATABASE_URL: databaseUrl },
		stdio: "pipe",
	});
}, 30000);

afterAll(async () => {
	await mockPrisma.$disconnect();
	rmSync(directory, { recursive: true, force: true });
});

beforeEach(async () => {
	await mockPrisma.assignedTask.deleteMany();
	await mockPrisma.presetTaskOrder.deleteMany();
	await mockPrisma.presetTask.deleteMany();
	await mockPrisma.household.deleteMany();
	await mockPrisma.user.deleteMany();
	await mockPrisma.user.createMany({ data: [{ id: "approver" }, { id: "doer" }, { id: "outsider" }] });
	await mockPrisma.household.createMany({
		data: [
			{ id: householdId, name: "Home", createdById: "approver" },
			{ id: "other", name: "Other", createdById: "outsider" },
		],
	});
	await mockPrisma.householdMember.createMany({
		data: [
			{ householdId, userId: "approver", role: "APPROVER" },
			{ householdId, userId: "doer", role: "DOER" },
			{ householdId: "other", userId: "outsider", role: "DICTATOR" },
		],
	});
});

test("creates a shared preset and assigns it in one call", async () => {
	const { preset, assignedTask } = await assignments("approver").createWithPreset(input());

	expect(preset).toMatchObject({
		label: "Water plants",
		bucket: "ROUTINE",
		isShared: true,
		createdById: "approver",
		approvalOverride: "REQUIRE",
		sortOrder: 0,
	});
	expect(assignedTask).toMatchObject({
		householdId,
		presetId: preset.id,
		assignedToId: "doer",
		assignedById: "approver",
		cadenceTarget: 2,
		cadenceIntervalMinutes: 10080,
		isRecurring: true,
		status: "ACTIVE",
	});

	// The new preset is visible to other members' preset lists and usable for further assignments.
	const { presets } = await presetsRouter.createCaller(callerContext("doer")).list({ householdId });
	expect(presets.map((entry) => entry.id)).toContain(preset.id);
	await expect(
		assignments("approver").create({
			householdId,
			presetId: preset.id,
			assigneeId: null,
			cadenceTarget: 1,
			cadenceIntervalMinutes: 1440,
			isRecurring: false,
		}),
	).resolves.toMatchObject({ assignedTask: { presetId: preset.id, assignedToId: null } });
});

test("normalizes one-off targets and supports Open tasks", async () => {
	const { assignedTask } = await assignments("approver").createWithPreset(
		input({ assigneeId: null, isRecurring: false, cadenceTarget: 5 }),
	);
	expect(assignedTask).toMatchObject({ assignedToId: null, isRecurring: false, cadenceTarget: 1 });
});

test("rejects non-approvers and non-members without creating a preset", async () => {
	await expect(assignments("doer").createWithPreset(input())).rejects.toMatchObject({ code: "FORBIDDEN" });
	await expect(assignments("outsider").createWithPreset(input())).rejects.toMatchObject({ code: "FORBIDDEN" });
	expect(await mockPrisma.presetTask.count()).toBe(0);
	expect(await mockPrisma.assignedTask.count()).toBe(0);
});

test("a failed assignment leaves no orphan preset", async () => {
	await expect(assignments("approver").createWithPreset(input({ assigneeId: "outsider" }))).rejects.toMatchObject({
		code: "BAD_REQUEST",
		message: "Assignee not found in household",
	});
	await expect(assignments("approver").createWithPreset(input({ assigneeId: "missing-user" }))).rejects.toMatchObject({
		code: "BAD_REQUEST",
	});
	expect(await mockPrisma.presetTask.count()).toBe(0);
	expect(await mockPrisma.presetTaskOrder.count()).toBe(0);
	expect(await mockPrisma.assignedTask.count()).toBe(0);
});

test("rolls back the preset when writing the assignment fails", async () => {
	const runTransaction = mockPrisma.$transaction.bind(mockPrisma) as (
		fn: (tx: unknown) => Promise<unknown>,
	) => Promise<unknown>;
	const failingAssignment = {
		create: () => {
			throw new Error("disk full");
		},
	};
	const consoleError = jest.spyOn(console, "error").mockImplementation(() => {});
	jest.spyOn(mockPrisma, "$transaction").mockImplementationOnce(((fn: (tx: unknown) => Promise<unknown>) =>
		runTransaction((tx) =>
			fn(
				new Proxy(tx as object, {
					get: (target, key) => (key === "assignedTask" ? failingAssignment : Reflect.get(target, key)),
				}),
			),
		)) as never);

	await expect(assignments("approver").createWithPreset(input())).rejects.toMatchObject({
		code: "INTERNAL_SERVER_ERROR",
		message: "Failed to assign task",
	});
	expect(consoleError).toHaveBeenCalled();
	consoleError.mockRestore();
	expect(await mockPrisma.presetTask.count()).toBe(0);
	expect(await mockPrisma.presetTaskOrder.count()).toBe(0);
});

test("validates the new preset's label and bucket", async () => {
	const caller = assignments("approver");
	await expect(caller.createWithPreset(input({ preset: { label: " x ", bucket: "QUICK" } }))).rejects.toMatchObject({
		code: "BAD_REQUEST",
	});
	await expect(
		caller.createWithPreset(input({ preset: { label: "Valid", bucket: "ENORMOUS" } })),
	).rejects.toMatchObject({ code: "BAD_REQUEST" });
	expect(await mockPrisma.presetTask.count()).toBe(0);
});
