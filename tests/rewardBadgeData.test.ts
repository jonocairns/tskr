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
import { getRewardBadgeData } from "@/lib/rewardBadgeData";

const directory = mkdtempSync(join(tmpdir(), "tskr-reward-badge-"));
const databaseUrl = `file:${join(directory, "test.db")}`;
const mockPrisma = new PrismaClient({ adapter: new PrismaBetterSqlite3({ url: databaseUrl }) });

beforeAll(async () => {
	execFileSync(process.execPath, [require.resolve("prisma/build/index.js"), "migrate", "deploy"], {
		env: { ...process.env, DATABASE_URL: databaseUrl },
		stdio: "pipe",
	});
	await mockPrisma.user.createMany({ data: [{ id: "member" }, { id: "other" }] });
	await mockPrisma.household.createMany({
		data: [
			{ id: "home", name: "Home", createdById: "member", rewardThreshold: 40, progressBarColor: "#123456" },
			{ id: "away", name: "Away", createdById: "member" },
		],
	});
	const log = (householdId: string, userId: string, points: number, extra: object = {}) => ({
		householdId,
		userId,
		points,
		description: "Task",
		...extra,
	});
	await mockPrisma.pointLog.createMany({
		data: [
			log("home", "member", 30),
			log("home", "member", 25),
			log("home", "member", -40, { kind: "REWARD", rewardCost: 40 }),
			log("home", "member", 50, { status: "PENDING" }),
			log("home", "member", 50, { revertedAt: new Date() }),
			log("home", "other", 50),
			log("away", "member", 50),
		],
	});
});

afterAll(async () => {
	await mockPrisma.$disconnect();
	rmSync(directory, { recursive: true, force: true });
});

test("uses the approved, unreverted balance in this household after claims", async () => {
	expect(await getRewardBadgeData("home", "member")).toEqual({
		points: 15,
		threshold: 40,
		claimsRemaining: null,
		refreshAt: null,
		progressBarColor: "#123456",
	});
});

test("reports the remaining claim allowance when a limit applies", async () => {
	await mockPrisma.rewardClaimLimit.create({
		data: { householdId: "away", scope: "HOUSEHOLD", period: "WEEK", maxClaims: 2, sortOrder: 0 },
	});
	const data = await getRewardBadgeData("away", "member");
	expect(data).toMatchObject({ points: 50, claimsRemaining: 2 });
	// A calendar-week rule reports when its window next resets.
	expect(data?.refreshAt).toEqual(expect.any(String));
});

test("returns null instead of throwing when the household is missing", async () => {
	const consoleError = jest.spyOn(console, "error").mockImplementation(() => {});
	expect(await getRewardBadgeData("missing", "member")).toBeNull();
	expect(consoleError).toHaveBeenCalled();
	consoleError.mockRestore();
});
