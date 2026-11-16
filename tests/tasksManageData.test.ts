jest.mock("@/lib/prisma", () => ({
	get prisma() {
		return mockPrisma;
	},
}));

import { execFileSync } from "node:child_process";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { PrismaBetterSqlite3 } from "@prisma/adapter-better-sqlite3";
import { PrismaClient } from "@prisma/client";
import { getTasksManageData, getTasksTodoData } from "@/lib/tasks/queries";

const directory = mkdtempSync(join(tmpdir(), "tskr-tasks-manage-"));
const databaseUrl = `file:${join(directory, "test.db")}`;
const mockPrisma = new PrismaClient({ adapter: new PrismaBetterSqlite3({ url: databaseUrl }) });
const now = new Date("2024-01-07T12:30:00Z"); // Monday in Auckland, still Sunday in UTC.
const query = { householdId: "home", userId: "approver", now, timeZone: "Pacific/Auckland" };

beforeAll(async () => {
	execFileSync(process.execPath, [require.resolve("prisma/build/index.js"), "migrate", "deploy"], {
		env: { ...process.env, DATABASE_URL: databaseUrl },
		stdio: "pipe",
	});
	await mockPrisma.user.createMany({ data: [{ id: "approver" }, { id: "member" }] });
	await mockPrisma.household.create({ data: { id: "home", name: "Home", createdById: "approver" } });
	await mockPrisma.householdMember.createMany({
		data: [
			{ householdId: "home", userId: "approver", role: "APPROVER" },
			{ householdId: "home", userId: "member", role: "DOER" },
		],
	});
	await mockPrisma.presetTask.createMany({
		data: [
			{ id: "first", householdId: "home", label: "First", bucket: "QUICK", isShared: true, createdById: "approver" },
			{ id: "second", householdId: "home", label: "Second", bucket: "QUICK", isShared: true, createdById: "approver" },
			{
				id: "personal",
				householdId: "home",
				label: "Legacy personal",
				bucket: "QUICK",
				isShared: false,
				createdById: "member",
			},
		],
	});
	await mockPrisma.presetTaskOrder.createMany({
		data: [
			{ householdId: "home", userId: "approver", presetId: "second", sortOrder: 0 },
			{ householdId: "home", userId: "approver", presetId: "first", sortOrder: 1 },
		],
	});
	await mockPrisma.assignedTask.createMany({
		data: [
			{
				id: "fulfilled",
				householdId: "home",
				presetId: "first",
				assignedToId: "member",
				isRecurring: true,
				cadenceTarget: 2,
				cadenceIntervalMinutes: 10080,
				assignedAt: new Date("2024-01-01"),
			},
			{
				id: "partial",
				householdId: "home",
				presetId: "second",
				isRecurring: true,
				cadenceTarget: 2,
				cadenceIntervalMinutes: 10080,
				assignedAt: new Date("2024-01-01"),
			},
			{
				id: "one-off",
				householdId: "home",
				presetId: "personal",
				isRecurring: false,
				cadenceTarget: 1,
				cadenceIntervalMinutes: 1440,
				assignedAt: new Date("2024-01-01"),
			},
			{
				id: "inactive",
				householdId: "home",
				presetId: "first",
				status: "COMPLETED",
				cadenceTarget: 1,
				cadenceIntervalMinutes: 1440,
			},
		],
	});
	const log = (assignedTaskId: string, createdAt: string) => ({
		householdId: "home",
		userId: "member",
		assignedTaskId,
		points: 3,
		description: "Done",
		createdAt: new Date(createdAt),
	});
	await mockPrisma.pointLog.createMany({
		data: [
			log("fulfilled", "2024-01-07T11:10:00Z"),
			log("fulfilled", "2024-01-07T11:20:00Z"),
			log("fulfilled", "2024-01-07T10:59:00Z"), // Prior household week.
			{ ...log("partial", "2024-01-07T11:10:00Z"), status: "PENDING" },
			{ ...log("partial", "2024-01-07T11:15:00Z"), status: "REJECTED" },
			{ ...log("partial", "2024-01-07T11:20:00Z"), revertedAt: now },
			log("partial", "2024-01-07T10:59:00Z"),
			log("one-off", "2024-01-01T12:00:00Z"),
		],
	});
}, 30000);

afterAll(async () => {
	await mockPrisma.$disconnect();
	rmSync(directory, { recursive: true, force: true });
});

test("Manage keeps fulfilled ACTIVE tasks and computes progress using household cycles and qualifying history", async () => {
	const { tasks } = await getTasksManageData(query);
	expect(tasks.map((task) => task.id).sort()).toEqual(["fulfilled", "one-off", "partial"]);
	expect(tasks.find((task) => task.id === "fulfilled")?.progress).toEqual({
		completed: 2,
		target: 2,
		isRecurring: true,
	});
	expect(tasks.find((task) => task.id === "partial")?.progress).toEqual({ completed: 1, target: 2, isRecurring: true });
	expect(tasks.find((task) => task.id === "one-off")?.progress).toEqual({
		completed: 1,
		target: 1,
		isRecurring: false,
	});
	const todo = await getTasksTodoData({ ...query, userId: "all", actingUserId: "approver" });
	expect(todo.map((task) => task.id)).toEqual(["partial"]);
});

test("Manage supplies members and ordered shared creation presets while retaining legacy personal tasks", async () => {
	const { members, presets, tasks } = await getTasksManageData(query);
	expect(members.map((member) => member.id).sort()).toEqual(["approver", "member"]);
	expect(presets.map((preset) => preset.id)).toEqual(["second", "first"]);
	expect(tasks.find((task) => task.id === "one-off")).toMatchObject({
		presetId: "personal",
		presetLabel: "Legacy personal",
	});
});
