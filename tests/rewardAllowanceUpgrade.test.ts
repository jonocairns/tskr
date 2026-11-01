import { execFileSync } from "node:child_process";
import { cpSync, mkdirSync, mkdtempSync, readdirSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { PrismaBetterSqlite3 } from "@prisma/adapter-better-sqlite3";
import { PrismaClient } from "@prisma/client";
import { claimReward } from "@/lib/claimReward";
import { getRewardClaimAllowance } from "@/lib/rewardClaimLimits";
import { releaseRewardAllocations } from "@/lib/rewardMonthlyAllowances";

const directory = mkdtempSync(join(tmpdir(), "tskr-upgrade-"));
const databaseUrl = `file:${join(directory, "upgrade.db")}`;
const migrationName = "20261101000000_monthly_reward_allowances";
const db = new PrismaClient({ adapter: new PrismaBetterSqlite3({ url: databaseUrl }) });
const now = new Date("2027-01-15T00:00:00Z");
const deploy = (config?: string) =>
	execFileSync(
		process.execPath,
		[require.resolve("prisma/build/index.js"), "migrate", "deploy", ...(config ? ["--config", config] : [])],
		{ env: { ...process.env, DATABASE_URL: databaseUrl }, stdio: "pipe" },
	);

beforeAll(() => {
	const oldMigrations = join(directory, "migrations");
	mkdirSync(oldMigrations);
	for (const name of readdirSync("prisma/migrations")) {
		if (name !== migrationName) cpSync(join("prisma/migrations", name), join(oldMigrations, name), { recursive: true });
	}
	const configPath = join(directory, "prisma.config.ts");
	writeFileSync(
		configPath,
		`export default ${JSON.stringify({ schema: resolve("prisma/schema.prisma"), migrations: { path: oldMigrations }, datasource: { url: databaseUrl } })};`,
	);
	deploy(configPath);
}, 30000);

afterAll(async () => {
	await db.$disconnect();
	rmSync(directory, { recursive: true, force: true });
});

test("a real old-schema SQLite database upgrades without changing rules, available claims, logs or points", async () => {
	await db.user.createMany({ data: [{ id: "alice" }, { id: "bob" }] });
	// The old Household table deliberately lacks rewardClaimRevision.
	await db.$executeRaw`INSERT INTO Household (id, name, createdById, rewardThreshold, timeZone, updatedAt) VALUES ('home', 'Existing home', 'alice', 50, 'Pacific/Auckland', CURRENT_TIMESTAMP), ('unlimited', 'Unlimited', 'alice', 50, 'UTC', CURRENT_TIMESTAMP)`;
	await db.householdMember.createMany({
		data: [
			{ householdId: "home", userId: "alice", joinedAt: new Date("2026-01-01T00:00:00Z") },
			{ householdId: "home", userId: "bob", joinedAt: new Date("2026-01-01T00:00:00Z") },
		],
	});
	await db.$executeRaw`INSERT INTO RewardClaimLimit (id, householdId, maxClaims, scope, userId, period, windowMinutes, sortOrder) VALUES
		('monthly', 'home', 2, 'HOUSEHOLD', NULL, 'MONTH', NULL, 0),
		('individual', 'home', 4, 'MEMBER', NULL, 'MONTH', NULL, 1),
		('named', 'home', 5, 'MEMBER', 'alice', 'MONTH', NULL, 2),
		('daily', 'home', 4, 'HOUSEHOLD', NULL, 'DAY', NULL, 3),
		('weekly', 'home', 6, 'HOUSEHOLD', NULL, 'WEEK', NULL, 4),
		('rolling', 'home', 7, 'HOUSEHOLD', NULL, 'ROLLING', 1440, 5)`;
	const beforeRules = await db.$queryRaw<
		Array<Record<string, unknown>>
	>`SELECT * FROM RewardClaimLimit ORDER BY sortOrder`;
	await db.pointLog.createMany({
		data: [
			{ id: "points", householdId: "home", userId: "alice", points: 500, description: "Points", createdAt: now },
			...["old-1", "old-2", "old-3"].map((id) => ({
				id,
				householdId: "home",
				userId: "alice",
				kind: "REWARD",
				points: -50,
				rewardCost: 50,
				description: "Claim",
				createdAt: now,
			})),
			{
				id: "reverted",
				householdId: "home",
				userId: "alice",
				kind: "REWARD",
				points: -50,
				description: "Reverted",
				createdAt: now,
				revertedAt: now,
			},
			{
				id: "pending",
				householdId: "home",
				userId: "alice",
				kind: "REWARD",
				points: -50,
				description: "Pending",
				createdAt: now,
				status: "PENDING",
			},
			{
				id: "rejected",
				householdId: "home",
				userId: "alice",
				kind: "REWARD",
				points: -50,
				description: "Rejected",
				createdAt: now,
				status: "REJECTED",
			},
			{
				id: "previous-month",
				householdId: "home",
				userId: "alice",
				kind: "REWARD",
				points: -50,
				description: "Older",
				createdAt: new Date("2026-12-31T10:59:59Z"),
			},
		],
	});
	const beforeLogs = await db.pointLog.findMany({ orderBy: { id: "asc" } });
	const points = await db.pointLog.aggregate({
		where: { revertedAt: null, status: "APPROVED" },
		_sum: { points: true },
	});
	expect(points._sum.points).toBe(300);
	deploy();
	deploy(); // Deploy/restarts cannot reset a grant or settings.
	const home = await db.household.findUniqueOrThrow({
		where: { id: "home" },
		include: { rewardClaimLimits: { orderBy: { sortOrder: "asc" } } },
	});
	expect(home.rewardClaimRevision).toBe(0);
	for (const [index, rule] of home.rewardClaimLimits.entries()) {
		expect(rule).toMatchObject({ ...beforeRules[index], rolloverEnabled: false, archivedAt: null });
	}
	expect(await db.pointLog.findMany({ orderBy: { id: "asc" } })).toEqual(beforeLogs);
	expect(await getRewardClaimAllowance(db, home, "home", "alice", now)).toMatchObject({
		remaining: 0,
		rules: [{ remaining: 0 }, { remaining: 1 }, { remaining: 2 }, { remaining: 1 }, { remaining: 3 }, { remaining: 4 }],
	});
	expect(await getRewardClaimAllowance(db, home, "home", "bob", now)).toMatchObject({
		remaining: 0,
		rules: [{ remaining: 0 }, { remaining: 4 }, { remaining: 1 }, { remaining: 3 }, { remaining: 4 }],
	});
	const grants = await db.rewardMonthlyGrant.count();
	await getRewardClaimAllowance(db, home, "home", "alice", now);
	expect(await db.rewardMonthlyGrant.count()).toBe(grants);
	await expect(db.$transaction((tx) => claimReward(tx, "alice", "home", now))).rejects.toMatchObject({
		code: "BAD_REQUEST",
	});
	expect(
		await db.pointLog.aggregate({ where: { revertedAt: null, status: "APPROVED" }, _sum: { points: true } }),
	).toEqual(points);
	// Over-limit historical usage is retained; the first undo still leaves the cap full.
	await db.$transaction(async (tx) => {
		await releaseRewardAllocations(tx, { id: "old-1", householdId: "home", userId: "alice" }, now);
		await tx.pointLog.update({ where: { id: "old-1" }, data: { revertedAt: now } });
	});
	expect(await getRewardClaimAllowance(db, home, "home", "alice", now)).toMatchObject({ remaining: 0 });
	const unlimited = await db.household.findUniqueOrThrow({
		where: { id: "unlimited" },
		include: { rewardClaimLimits: true },
	});
	expect(await getRewardClaimAllowance(db, unlimited, "unlimited", "alice", now)).toBeNull();
	expect(await db.pointLog.count()).toBe(beforeLogs.length);
	await expect(db.$executeRaw`UPDATE RewardClaimLimit SET maxClaims = 0 WHERE id = 'monthly'`).rejects.toThrow();
}, 30000);
