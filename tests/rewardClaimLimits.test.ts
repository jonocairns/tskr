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
import { type Prisma, PrismaClient } from "@prisma/client";
import { claimReward } from "@/lib/claimReward";
import { getRewardClaimAllowance, getRewardClaimWindow } from "@/lib/rewardClaimLimits";
import { type RewardClaimRule, rewardClaimRulesSchema } from "@/lib/rewardClaimSettings";
import { releaseRewardAllocations } from "@/lib/rewardMonthlyAllowances";
import { saveRewardClaimSettings } from "@/lib/saveRewardClaimSettings";
import { claimRouter } from "@/server/routers/claim";
import { householdCoreRouter } from "@/server/routers/households/core";
import { logsRouter } from "@/server/routers/logs";

const directory = mkdtempSync(join(tmpdir(), "tskr-rewards-"));
const databaseUrl = `file:${join(directory, "test.db")}`;
const mockPrisma = new PrismaClient({ adapter: new PrismaBetterSqlite3({ url: databaseUrl }) });
const claim = (userId = "alice") => mockPrisma.$transaction((tx) => claimReward(tx, userId, "home"));
const settings = (data: Prisma.HouseholdUpdateInput = {}) =>
	mockPrisma.household.update({
		where: { id: "home" },
		data,
		include: { rewardClaimLimits: { where: { archivedAt: null }, orderBy: { sortOrder: "asc" } } },
	});
const limits = (rules: Array<Partial<RewardClaimRule>>) =>
	settings({
		rewardClaimLimits: {
			deleteMany: {},
			create: rules.map((rule, sortOrder) => ({
				maxClaims: 1,
				period: "WEEK",
				windowMinutes: null,
				scope: "HOUSEHOLD",
				userId: null,
				...rule,
				sortOrder,
			})),
		},
	});
const reward = (data = {}) =>
	mockPrisma.pointLog.create({
		data: { householdId: "home", userId: "alice", kind: "REWARD", points: -50, description: "Reward", ...data },
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
	await mockPrisma.pointLog.deleteMany();
	await mockPrisma.household.deleteMany();
	await mockPrisma.user.deleteMany();
	await mockPrisma.user.createMany({ data: [{ id: "alice" }, { id: "bob" }] });
	await mockPrisma.household.createMany({
		data: [
			{ id: "home", name: "Home", createdById: "alice", timeZone: "Pacific/Auckland" },
			{ id: "other", name: "Other home", createdById: "alice" },
		],
	});
	await mockPrisma.householdMember.createMany({
		data: [
			{ householdId: "home", userId: "alice", role: "DICTATOR" },
			{ householdId: "home", userId: "bob", role: "DOER" },
		],
	});
	await mockPrisma.pointLog.createMany({
		data: [
			{ householdId: "home", userId: "alice", points: 500, description: "Tasks" },
			{ householdId: "home", userId: "bob", points: 500, description: "Tasks" },
		],
	});
});

test("migrated households stay unlimited and claims still deduct the configured cost", async () => {
	const household = await settings({ rewardThreshold: 75 });
	expect(household.rewardClaimLimits).toEqual([]);
	expect(await getRewardClaimAllowance(mockPrisma, household, "home", "alice")).toBeNull();
	const result = await claim();
	expect(result.remaining).toBe(425);
	expect(result.entry).toMatchObject({ kind: "REWARD", points: -75, rewardCost: 75, status: "APPROVED" });
});

test("a member cap blocks additional claims without deducting points and leaves other members their allowance", async () => {
	await limits([{ scope: "MEMBER" }]);
	await claim();
	await expect(claim()).rejects.toMatchObject({
		code: "BAD_REQUEST",
		cause: { appErrorCode: "REWARD_CLAIM_LIMIT_REACHED" },
	});
	expect(await mockPrisma.pointLog.count({ where: { kind: "REWARD" } })).toBe(1);
	await expect(claim("bob")).resolves.toMatchObject({ remaining: 450 });
});

test("shared caps include all members, but exclude other households", async () => {
	const household = await limits([{}]);
	await reward({ householdId: "other" });
	expect(await getRewardClaimAllowance(mockPrisma, household, "home", "alice")).toMatchObject({ remaining: 1 });
	await claim("bob");
	await expect(claim()).rejects.toMatchObject({ code: "BAD_REQUEST" });
	expect(await getRewardClaimAllowance(mockPrisma, household, "home", "alice")).toMatchObject({ remaining: 0 });
});

test("reverting a claim restores the allowance and the points", async () => {
	await limits([{}]);
	const first = await claim();
	await mockPrisma.pointLog.update({ where: { id: first.entry.id }, data: { revertedAt: new Date() } });
	await expect(claim()).resolves.toMatchObject({ remaining: 450 });
});

test("claims outside the current period, pending/rejected claims, and ordinary tasks do not consume allowance", async () => {
	const household = await limits([{ maxClaims: 2, period: "DAY" }]);
	const now = new Date("2026-10-31T12:00:00Z");
	const { start, end } = getRewardClaimWindow(now, "DAY", household.timeZone);
	await reward({ createdAt: new Date(start.getTime() - 1) });
	await reward({ createdAt: end });
	await reward({ createdAt: now, status: "PENDING" });
	await reward({ createdAt: now, status: "REJECTED" });
	await reward({ createdAt: now, revertedAt: now });
	await reward({ createdAt: now, kind: "PRESET", points: 5 });
	await reward({ createdAt: start });
	expect(await getRewardClaimAllowance(mockPrisma, household, "home", "alice", now)).toMatchObject({
		remaining: 1,
		changesAt: end.toISOString(),
	});
	// The claim exactly at the previous end belongs to the new day.
	expect(await getRewardClaimAllowance(mockPrisma, household, "home", "alice", end)).toMatchObject({ remaining: 1 });
});

test("enabling, lowering, changing periods, and disabling caps account for existing claims", async () => {
	await claim();
	await claim();
	let household = await limits([{ period: "MONTH" }]);
	expect(await getRewardClaimAllowance(mockPrisma, household, "home", "alice")).toMatchObject({ remaining: 0 });
	await expect(claim()).rejects.toMatchObject({ code: "BAD_REQUEST" });
	household = await limits([{ maxClaims: 3 }]);
	expect(await getRewardClaimAllowance(mockPrisma, household, "home", "alice")).toMatchObject({ remaining: 1 });
	await limits([]);
	await expect(claim()).resolves.toMatchObject({ remaining: 350 });
});

test("points are still required when allowance remains", async () => {
	await limits([{ maxClaims: 2 }]);
	await settings({ rewardThreshold: 600 });
	await expect(claim()).rejects.toMatchObject({ code: "BAD_REQUEST", message: "Not enough points to claim" });
	expect(await mockPrisma.pointLog.count({ where: { kind: "REWARD" } })).toBe(0);
});

test("simultaneous claims cannot exceed a shared allowance", async () => {
	await limits([{}]);
	const results = await Promise.allSettled([claim(), claim("bob"), claim(), claim("bob")]);
	expect(results.filter((result) => result.status === "fulfilled")).toHaveLength(1);
	expect(await mockPrisma.pointLog.count({ where: { kind: "REWARD" } })).toBe(1);
});

test.each([
	["2018-11-04T12:00:00Z", "DAY", "America/Sao_Paulo", "2018-11-04T03:00:00Z", "2018-11-05T02:00:00Z"],
	["2026-09-27T00:00:00Z", "DAY", "Pacific/Auckland", "2026-09-26T12:00:00Z", "2026-09-27T11:00:00Z"],
	["2026-04-05T00:00:00Z", "DAY", "Pacific/Auckland", "2026-04-04T11:00:00Z", "2026-04-05T12:00:00Z"],
	["2026-11-01T10:00:00Z", "WEEK", "Pacific/Auckland", "2026-10-25T11:00:00Z", "2026-11-01T11:00:00Z"],
	["2026-11-01T11:00:00Z", "WEEK", "Pacific/Auckland", "2026-11-01T11:00:00Z", "2026-11-08T11:00:00Z"],
	["2024-02-29T10:00:00Z", "MONTH", "UTC", "2024-02-01T00:00:00Z", "2024-03-01T00:00:00Z"],
	["2026-12-31T23:59:59Z", "MONTH", "UTC", "2026-12-01T00:00:00Z", "2027-01-01T00:00:00Z"],
] as const)("calendar boundaries for %s, %s in %s", (now, period, zone, start, end) => {
	expect(getRewardClaimWindow(new Date(now), period, zone)).toEqual({ start: new Date(start), end: new Date(end) });
});

test("household, common member, and named member caps all stack without overrides", async () => {
	const household = await limits([
		{ maxClaims: 4, period: "MONTH" },
		{ maxClaims: 2, scope: "MEMBER" },
		{ maxClaims: 1, scope: "MEMBER", userId: "alice", period: "ROLLING", windowMinutes: 2880 },
	]);
	await claim();
	await expect(claim()).rejects.toMatchObject({ code: "BAD_REQUEST" });
	await claim("bob");
	await claim("bob");
	await expect(claim("bob")).rejects.toMatchObject({ code: "BAD_REQUEST" });
	const alice = await getRewardClaimAllowance(mockPrisma, household, "home", "alice");
	const bob = await getRewardClaimAllowance(mockPrisma, household, "home", "bob");
	expect(alice?.rules.map((rule) => rule.remaining)).toEqual([1, 1, 0]);
	expect(bob?.rules.map((rule) => rule.remaining)).toEqual([1, 0]);
});

test("all calendar and rolling caps apply and the tightest allowance wins", async () => {
	const household = await limits([
		{ maxClaims: 2, period: "DAY" },
		{ maxClaims: 5, period: "WEEK" },
		{ maxClaims: 10, period: "MONTH" },
		{ maxClaims: 1, period: "ROLLING", windowMinutes: 2880 },
	]);
	await claim();
	expect(await getRewardClaimAllowance(mockPrisma, household, "home", "bob")).toMatchObject({
		remaining: 0,
		rules: [{ remaining: 1 }, { remaining: 4 }, { remaining: 9 }, { remaining: 0 }],
	});
	await expect(claim("bob")).rejects.toMatchObject({ code: "BAD_REQUEST" });
});

test("rolling windows release a slot exactly when its claim expires, without a calendar reset", async () => {
	const household = await limits([{ maxClaims: 2, period: "ROLLING", windowMinutes: 2880 }]);
	await reward({ createdAt: new Date("2026-10-29T12:00:00Z") });
	await reward({ createdAt: new Date("2026-10-30T18:00:00Z") });
	const now = new Date("2026-10-31T11:59:59.999Z");
	expect(await getRewardClaimAllowance(mockPrisma, household, "home", "bob", now)).toMatchObject({
		remaining: 0,
		changesAt: "2026-10-31T12:00:00.000Z",
	});
	expect(
		await getRewardClaimAllowance(mockPrisma, household, "home", "bob", new Date("2026-10-31T12:00:00Z")),
	).toMatchObject({
		remaining: 1,
		changesAt: "2026-11-01T18:00:00.000Z",
	});
});

test("lowering a rolling cap waits for enough claims to expire, rather than the oldest one", async () => {
	const household = await limits([{ maxClaims: 1, period: "ROLLING", windowMinutes: 60 }]);
	await reward({ createdAt: new Date("2026-10-31T11:10:00Z") });
	await reward({ createdAt: new Date("2026-10-31T11:40:00Z") });
	expect(
		await getRewardClaimAllowance(mockPrisma, household, "home", "alice", new Date("2026-10-31T12:00:00Z")),
	).toMatchObject({
		remaining: 0,
		changesAt: "2026-10-31T12:40:00.000Z",
	});
});

test("rolling days use elapsed hours across daylight saving", async () => {
	const household = await limits([{ period: "ROLLING", windowMinutes: 1440 }]);
	await reward({ createdAt: new Date("2026-09-26T12:00:00Z") });
	expect(
		await getRewardClaimAllowance(mockPrisma, household, "home", "alice", new Date("2026-09-27T11:30:00Z")),
	).toMatchObject({ remaining: 0 });
	expect(
		await getRewardClaimAllowance(mockPrisma, household, "home", "alice", new Date("2026-09-27T12:00:00Z")),
	).toMatchObject({ remaining: 1 });
});

test("rules for another member do not restrict a user with no applicable caps", async () => {
	const household = await limits([{ scope: "MEMBER", userId: "alice" }]);
	expect(await getRewardClaimAllowance(mockPrisma, household, "home", "bob")).toBeNull();
	await expect(claim("bob")).resolves.toMatchObject({ remaining: 450 });
});

test.each([
	{ maxClaims: 0 },
	{ maxClaims: 1.5 },
	{ maxClaims: 10001 },
	{ period: "ROLLING", windowMinutes: null },
	{ period: "ROLLING", windowMinutes: 0 },
	{ period: "ROLLING", windowMinutes: 525601 },
	{ period: "DAY", windowMinutes: 60 },
	{ scope: "HOUSEHOLD", userId: "alice" },
])("rejects invalid rule: %j", (invalid) => {
	expect(
		rewardClaimRulesSchema.safeParse([
			{ maxClaims: 1, period: "WEEK", windowMinutes: null, scope: "HOUSEHOLD", userId: null, ...invalid },
		]).success,
	).toBe(false);
});

const callerContext = (userId: string) => ({
	req: undefined,
	session: { user: { id: userId }, expires: new Date(Date.now() + 60000).toISOString() },
	sessionTimestamps: { iat: Math.floor(Date.now() / 1000), lastActivity: Math.floor(Date.now() / 1000) },
});

test("managers can save and remove combined limits through the actual settings router", async () => {
	const caller = householdCoreRouter.createCaller(callerContext("alice"));
	const rule: RewardClaimRule = { maxClaims: 1, period: "WEEK", windowMinutes: null, scope: "HOUSEHOLD", userId: null };
	await caller.updateCurrent({
		householdId: "home",
		rewardClaimLimits: [rule, { ...rule, scope: "MEMBER", userId: "bob", period: "ROLLING", windowMinutes: 2880 }],
	});
	const saved = await caller.getCurrent({ householdId: "home" });
	expect(saved.household.rewardClaimLimits).toHaveLength(2);
	await claim();
	const claimant = claimRouter.createCaller(callerContext("bob"));
	await expect(claimant.claimReward({ householdId: "home" })).rejects.toMatchObject({
		cause: { appErrorCode: "REWARD_CLAIM_LIMIT_REACHED" },
	});
	await caller.updateCurrent({
		householdId: "home",
		rewardClaimLimits: [],
		rewardClaimRevision: saved.household.rewardClaimRevision,
	});
	await expect(claimant.claimReward({ householdId: "home" })).resolves.toMatchObject({ remaining: 450 });
});

test("ordinary members cannot change limits, and nonmembers cannot claim", async () => {
	const caller = householdCoreRouter.createCaller(callerContext("bob"));
	await expect(caller.updateCurrent({ householdId: "home", rewardClaimLimits: [] })).rejects.toMatchObject({
		code: "FORBIDDEN",
	});
	const claimant = claimRouter.createCaller(callerContext("bob"));
	await expect(claimant.claimReward({ householdId: "other" })).rejects.toMatchObject({ code: "FORBIDDEN" });
});

test("the settings router rejects targets outside the household without replacing existing limits", async () => {
	await limits([{}]);
	await mockPrisma.user.create({ data: { id: "outsider" } });
	const caller = householdCoreRouter.createCaller(callerContext("alice"));
	await expect(
		caller.updateCurrent({
			householdId: "home",
			rewardClaimRevision: 0,
			rewardClaimLimits: [{ maxClaims: 1, period: "DAY", windowMinutes: null, scope: "MEMBER", userId: "outsider" }],
		}),
	).rejects.toMatchObject({ code: "BAD_REQUEST" });
	expect((await settings()).rewardClaimLimits).toMatchObject([{ period: "WEEK", scope: "HOUSEHOLD" }]);
});

test("a manager's limits-only save preserves another manager's changes to unrelated settings", async () => {
	await mockPrisma.householdMember.update({
		where: { householdId_userId: { householdId: "home", userId: "bob" } },
		data: { role: "DICTATOR" },
	});
	const alice = householdCoreRouter.createCaller(callerContext("alice"));
	const bob = householdCoreRouter.createCaller(callerContext("bob"));
	await alice.getCurrent({ householdId: "home" });
	await bob.updateCurrent({
		householdId: "home",
		name: "New household name",
		rewardThreshold: 100,
		progressBarColor: "#123456",
	});
	await alice.updateCurrent({
		householdId: "home",
		rewardClaimLimits: [{ maxClaims: 2, period: "WEEK", scope: "HOUSEHOLD", userId: null, windowMinutes: null }],
	});
	expect((await alice.getCurrent({ householdId: "home" })).household).toMatchObject({
		name: "New household name",
		rewardThreshold: 100,
		progressBarColor: "#123456",
		rewardClaimLimits: [{ maxClaims: 2 }],
	});
});

describe("monthly allowance accounting", () => {
	const at = (value: string) => new Date(value);
	const jan = at("2027-01-10T00:00:00Z");
	const feb = at("2027-02-10T00:00:00Z");
	const mar = at("2027-03-10T00:00:00Z");
	const apr = at("2027-04-10T00:00:00Z");
	const balance = async (now: Date, userId = "alice") =>
		getRewardClaimAllowance(mockPrisma, await settings(), "home", userId, now);
	const spend = (now: Date, userId = "alice") => mockPrisma.$transaction((tx) => claimReward(tx, userId, "home", now));
	const edit = async (rules: RewardClaimRule[], now: Date) => {
		const household = await settings();
		await mockPrisma.$transaction((tx) =>
			saveRewardClaimSettings(tx, "home", rules, household.rewardClaimRevision, undefined, now),
		);
		return settings();
	};
	const monthly = (overrides: Partial<RewardClaimRule> = {}) => ({
		maxClaims: 2,
		period: "MONTH" as const,
		windowMinutes: null,
		scope: "HOUSEHOLD" as const,
		userId: null,
		rolloverEnabled: true,
		...overrides,
	});
	const undo = (log: { id: string; householdId: string; userId: string }, now: Date) =>
		mockPrisma.$transaction(async (tx) => {
			await releaseRewardAllocations(tx, log, now);
			await tx.pointLog.update({ where: { id: log.id }, data: { revertedAt: now, revertedById: "alice" } });
		});

	beforeEach(async () => {
		await mockPrisma.householdMember.updateMany({ data: { joinedAt: at("2026-01-01T00:00:00Z") } });
	});

	test("unused units accumulate to a quantity cap, survive skipped months, and retain their grant month", async () => {
		await edit([monthly()], jan);
		expect(await balance(jan)).toMatchObject({ remaining: 2, rules: [{ thisMonth: 2, carried: 0 }] });
		expect(await balance(feb)).toMatchObject({ remaining: 4, rules: [{ thisMonth: 2, carried: 2 }] });
		expect(await balance(at("2027-08-10T00:00:00Z"))).toMatchObject({
			remaining: 4,
			rules: [{ thisMonth: 2, carried: 2 }],
		});
		const grants = await mockPrisma.rewardMonthlyGrant.findMany({ orderBy: { month: "asc" } });
		expect(grants).toHaveLength(8);
		expect(grants[0]).toMatchObject({ month: "2027-01", amount: 2, forfeited: 0, expiresAt: null });
		expect(grants[1]).toMatchObject({ month: "2027-02", amount: 2, forfeited: 2 });
		// A new client/restart reuses the same durable grants.
		const restarted = new PrismaClient({ adapter: new PrismaBetterSqlite3({ url: databaseUrl }) });
		try {
			expect(
				await getRewardClaimAllowance(restarted, await settings(), "home", "alice", at("2027-08-11T00:00:00Z")),
			).toMatchObject({ remaining: 4 });
		} finally {
			await restarted.$disconnect();
		}
		expect(await mockPrisma.rewardMonthlyGrant.count()).toBe(8);
	});

	test.each([false, true])(
		"future grants stay unavailable after a clock rewind (carryover: %s)",
		async (rolloverEnabled) => {
			await edit([monthly({ rolloverEnabled })], jan);
			await edit(
				(await settings()).rewardClaimLimits.map((rule) => ({ ...rule, maxClaims: 5 })),
				jan,
			);
			expect(await balance(feb)).toMatchObject({ remaining: rolloverEnabled ? 7 : 5 });

			expect(await balance(jan)).toMatchObject({
				remaining: 2,
				changesAt: "2027-01-31T11:00:00.000Z",
				rules: [{ maxClaims: 2, thisMonth: 2, carried: 0 }],
			});
			await spend(jan);
			await spend(jan);
			await expect(spend(jan)).rejects.toMatchObject({ code: "BAD_REQUEST" });
			expect(await mockPrisma.rewardClaimAllocation.count({ where: { grant: { month: "2027-02" } } })).toBe(0);
			expect(await balance(feb)).toMatchObject({ remaining: 5, rules: [{ thisMonth: 5, carried: 0 }] });
		},
	);

	test("rewinding before the first grant exposes no allowance", async () => {
		await edit([monthly()], feb);
		expect(await balance(jan)).toMatchObject({
			remaining: 0,
			changesAt: "2027-01-31T11:00:00.000Z",
			rules: [{ maxClaims: 0, thisMonth: 0, carried: 0 }],
		});
		await expect(spend(jan)).rejects.toMatchObject({ code: "BAD_REQUEST" });
		expect(await mockPrisma.rewardClaimAllocation.count()).toBe(0);
		expect(await balance(feb)).toMatchObject({ remaining: 2 });
	});

	test("spends oldest valid grants first and restores the original grant on a later reversal", async () => {
		await edit([monthly()], jan);
		const first = await spend(feb);
		const second = await spend(feb);
		const third = await spend(feb);
		const allocations = await mockPrisma.rewardClaimAllocation.findMany({
			include: { grant: true },
			orderBy: { logId: "asc" },
		});
		expect(allocations.filter((allocation) => allocation.grant.month === "2027-01")).toHaveLength(2);
		expect(allocations.find((allocation) => allocation.logId === third.entry.id)?.grant.month).toBe("2027-02");
		expect(await balance(mar)).toMatchObject({ remaining: 3 });
		await undo(first.entry, mar);
		expect(await balance(mar)).toMatchObject({ remaining: 4, rules: [{ thisMonth: 2, carried: 2 }] });
		await undo(first.entry, mar); // Retried releases do not duplicate credit.
		expect(await balance(mar)).toMatchObject({ remaining: 4 });
		await undo(second.entry, mar);
		expect(await balance(mar)).toMatchObject({ remaining: 5 });
	});

	test("late reversals cannot bank forfeited unused claims or revive an expired grant", async () => {
		await edit([monthly({ rolloverEnabled: false })], jan);
		const claim = await spend(jan);
		await undo(claim.entry, feb); // Advance while the claim is still spent.
		expect(await balance(feb)).toMatchObject({ remaining: 2, rules: [{ carried: 0 }] });
		const rules = (await settings()).rewardClaimLimits;
		await edit(
			rules.map((rule) => ({ ...rule, rolloverEnabled: true })),
			feb,
		);
		expect(await balance(feb)).toMatchObject({ remaining: 2 });
		expect(await balance(mar)).toMatchObject({ remaining: 4 });
		await spend(mar);
		const latest = await spend(mar);
		// February is spent, March's unspent 2 can now be banked; January stays expired.
		expect(await balance(apr)).toMatchObject({ remaining: 4 });
		await undo(latest.entry, apr);
		expect(await balance(apr)).toMatchObject({ remaining: 5 });
		const janGrant = await mockPrisma.rewardMonthlyGrant.findFirstOrThrow({ where: { month: "2027-01" } });
		expect(janGrant.expiresAt).not.toBeNull();
	});

	test("initial enabling counts current usage, over-limit usage and historical reversals without a fresh grant", async () => {
		await limits([{ maxClaims: 2, period: "MONTH" }]);
		const logs = await Promise.all([
			reward({ createdAt: jan }),
			reward({ createdAt: jan }),
			reward({ createdAt: jan }),
		]);
		const household = await settings();
		await edit(
			household.rewardClaimLimits.map((rule) => ({ ...rule, rolloverEnabled: true })),
			jan,
		);
		expect(await balance(jan)).toMatchObject({ remaining: 0 });
		await undo(logs[0], jan);
		expect(await balance(jan)).toMatchObject({ remaining: 0 });
		await undo(logs[1], jan);
		expect(await balance(jan)).toMatchObject({ remaining: 1 });
		await undo(logs[1], jan);
		expect(await balance(jan)).toMatchObject({ remaining: 1 });
		const oldLog = await reward({ createdAt: at("2026-12-01T00:00:00Z") });
		await undo(oldLog, jan);
		expect(await balance(jan)).toMatchObject({ remaining: 1 });
		expect(await mockPrisma.rewardMonthlyGrant.count()).toBe(1);
		expect(await mockPrisma.rewardClaimAllocation.count({ where: { logId: oldLog.id } })).toBe(0);
	});

	test("lower limits are prospective, preserve a bank above the new cap and do not accumulate more", async () => {
		let household = await edit([monthly({ maxClaims: 4 })], jan);
		await balance(feb);
		household = await edit(
			household.rewardClaimLimits.map((rule) => ({ ...rule, maxClaims: 1 })),
			feb,
		);
		expect(await balance(feb)).toMatchObject({ remaining: 8, rules: [{ maxClaims: 4, thisMonth: 4, carried: 4 }] });
		expect(await balance(mar)).toMatchObject({ remaining: 5, rules: [{ maxClaims: 1, thisMonth: 1, carried: 4 }] });
		expect(await balance(at("2027-09-10T00:00:00Z"))).toMatchObject({ remaining: 5 });
		expect(household.rewardClaimLimits[0].maxClaims).toBe(1);
	});

	test("a reversal restores spent units without resurrecting unused units forfeited by a lower carry cap", async () => {
		const household = await edit([monthly({ maxClaims: 4 })], jan);
		const log = (await spend(jan)).entry;
		await edit(
			household.rewardClaimLimits.map((rule) => ({ ...rule, maxClaims: 1 })),
			jan,
		);
		expect(await balance(feb)).toMatchObject({ remaining: 2, rules: [{ thisMonth: 1, carried: 1 }] });
		await undo(log, feb);
		expect(await balance(feb)).toMatchObject({ remaining: 3, rules: [{ thisMonth: 1, carried: 2 }] });
		expect(await mockPrisma.rewardMonthlyGrant.findFirstOrThrow({ where: { month: "2027-01" } })).toMatchObject({
			amount: 4,
			forfeited: 2,
		});
		expect(await balance(mar)).toMatchObject({ remaining: 3 });
	});

	test("disabling and reenabling are prospective and preserve saved claims without banking disabled months", async () => {
		let household = await edit([monthly()], jan);
		await balance(feb);
		household = await edit(
			household.rewardClaimLimits.map((rule) => ({ ...rule, rolloverEnabled: false })),
			feb,
		);
		expect(await balance(mar)).toMatchObject({ remaining: 4, rules: [{ carried: 2 }] });
		household = await edit(
			household.rewardClaimLimits.map((rule) => ({ ...rule, rolloverEnabled: true })),
			mar,
		);
		await spend(mar); // Uses saved January allowance; March is still non-carrying.
		expect(await balance(apr)).toMatchObject({ remaining: 3, rules: [{ thisMonth: 2, carried: 1 }] });
		expect(await balance(at("2027-05-10T00:00:00Z"))).toMatchObject({ remaining: 4, rules: [{ carried: 2 }] });
	});

	test("repeated pending edits use the latest future policy and keep the active grant unchanged", async () => {
		let household = await edit([monthly()], jan);
		household = await edit(
			household.rewardClaimLimits.map((rule) => ({ ...rule, maxClaims: 5 })),
			jan,
		);
		await edit(
			household.rewardClaimLimits.map((rule) => ({ ...rule, maxClaims: 3 })),
			jan,
		);
		expect(await balance(jan)).toMatchObject({ remaining: 2 });
		expect(await balance(feb)).toMatchObject({ remaining: 5, rules: [{ maxClaims: 3, carried: 2 }] });
		expect(await mockPrisma.rewardMonthlyPolicy.count()).toBe(3);
	});

	test("month boundaries use household time including Auckland's UTC offset", async () => {
		await edit([monthly()], jan);
		expect(await balance(at("2027-01-31T10:59:59.999Z"))).toMatchObject({
			remaining: 2,
			changesAt: "2027-01-31T11:00:00.000Z",
		});
		expect(await balance(at("2027-01-31T11:00:00.000Z"))).toMatchObject({
			remaining: 4,
			rules: [{ thisMonth: 2, carried: 2 }],
		});
	});

	test("shared, each-member and named-member balances all apply without transferring units", async () => {
		await edit(
			[
				monthly({ maxClaims: 5 }),
				monthly({ scope: "MEMBER" }),
				monthly({ scope: "MEMBER", userId: "alice", maxClaims: 1 }),
			],
			jan,
		);
		await spend(feb);
		await spend(feb);
		await expect(spend(feb)).rejects.toMatchObject({ cause: { appErrorCode: "REWARD_CLAIM_LIMIT_REACHED" } });
		expect(await balance(feb, "bob")).toMatchObject({ remaining: 4, rules: [{ remaining: 8 }, { remaining: 4 }] });
		await spend(feb, "bob");
		expect(await mockPrisma.rewardClaimAllocation.count()).toBe(8);
		expect(await balance(feb)).toMatchObject({ remaining: 0 });
	});

	test("individual grants start at joining and never accrue across a membership gap", async () => {
		await edit([monthly({ scope: "MEMBER" })], jan);
		await mockPrisma.householdMember.delete({ where: { householdId_userId: { householdId: "home", userId: "bob" } } });
		await mockPrisma.householdMember.create({ data: { householdId: "home", userId: "bob", joinedAt: mar } });
		expect(await balance(mar, "bob")).toMatchObject({ remaining: 2, rules: [{ carried: 0 }] });
		expect(await balance(at("2027-07-10T00:00:00Z"), "bob")).toMatchObject({ remaining: 4 });
		const member = await mockPrisma.householdMember.findUniqueOrThrow({
			where: { householdId_userId: { householdId: "home", userId: "bob" } },
		});
		const account = await mockPrisma.rewardAllowanceAccount.findFirstOrThrow({
			where: { ownerKey: member.id },
			include: { grants: true },
		});
		expect(account.grants.map((grant) => grant.month).sort()).toEqual([
			"2027-03",
			"2027-04",
			"2027-05",
			"2027-06",
			"2027-07",
		]);
	});

	test("target changes create a fresh identity and retain the old account without transferring its bank", async () => {
		let household = await edit([monthly({ scope: "MEMBER", userId: "alice" })], jan);
		const oldId = household.rewardClaimLimits[0].id;
		await balance(feb);
		household = await edit(
			household.rewardClaimLimits.map((rule) => ({ ...rule, userId: "bob" })),
			feb,
		);
		expect(household.rewardClaimLimits[0].id).not.toBe(oldId);
		expect(await balance(feb, "bob")).toMatchObject({ remaining: 2 });
		expect(await mockPrisma.rewardClaimLimit.findUnique({ where: { id: oldId } })).toMatchObject({ archivedAt: feb });
		expect(await mockPrisma.rewardAllowanceAccount.count()).toBe(2);
	});

	test("concurrent monthly claims cannot overdraw shared grants or deduct extra points", async () => {
		await edit([monthly({ maxClaims: 1 })], jan);
		const results = await Promise.allSettled([spend(jan), spend(jan, "bob"), spend(jan)]);
		expect(results.filter((result) => result.status === "fulfilled")).toHaveLength(1);
		expect(await mockPrisma.rewardClaimAllocation.count()).toBe(1);
		expect((await mockPrisma.pointLog.aggregate({ _sum: { points: true } }))._sum.points).toBe(950);
	});

	test("timezone changes preserve the active month's boundary for existing and newly joined members", async () => {
		const household = await edit([monthly({ scope: "MEMBER" })], jan);
		await mockPrisma.$transaction(async (tx) => {
			await saveRewardClaimSettings(tx, "home", undefined, household.rewardClaimRevision, "UTC", jan);
			await tx.household.update({ where: { id: "home" }, data: { timeZone: "UTC" } });
		});
		expect(await balance(jan)).toMatchObject({ changesAt: "2027-01-31T11:00:00.000Z" });
		const joinedAt = at("2027-01-31T12:00:00Z");
		await mockPrisma.householdMember.delete({ where: { householdId_userId: { householdId: "home", userId: "bob" } } });
		await mockPrisma.householdMember.create({ data: { householdId: "home", userId: "bob", joinedAt } });
		expect(await balance(joinedAt)).toMatchObject({ remaining: 4, changesAt: "2027-03-01T00:00:00.000Z" });
		expect(await balance(joinedAt, "bob")).toMatchObject({ remaining: 2, changesAt: "2027-03-01T00:00:00.000Z" });
		const newest = await mockPrisma.rewardMonthlyGrant.findFirstOrThrow({ orderBy: { id: "desc" } });
		expect(newest).toMatchObject({ month: "2027-02", startsAt: at("2027-01-31T11:00:00Z") });
	});

	test("former members' claims can be reversed without creating or crediting a replacement membership", async () => {
		await edit([monthly({ scope: "MEMBER" })], jan);
		const log = (await spend(jan, "bob")).entry;
		await mockPrisma.householdMember.delete({ where: { householdId_userId: { householdId: "home", userId: "bob" } } });
		await undo(log, feb);
		await mockPrisma.householdMember.create({ data: { householdId: "home", userId: "bob", joinedAt: feb } });
		expect(await balance(feb, "bob")).toMatchObject({ remaining: 2, rules: [{ carried: 0 }] });
		expect(await mockPrisma.rewardClaimAllocation.count({ where: { logId: log.id } })).toBe(1);
	});

	test("separate database connections cannot duplicate initialization or spend a shared grant twice", async () => {
		await limits([{ period: "MONTH", maxClaims: 1, rolloverEnabled: true }]);
		const second = new PrismaClient({ adapter: new PrismaBetterSqlite3({ url: databaseUrl }) });
		try {
			await Promise.allSettled([spend(jan), second.$transaction((tx) => claimReward(tx, "bob", "home", jan))]);
			// SQLite may reject a competing writer; an ordinary retry must be safe.
			if (!(await mockPrisma.pointLog.count({ where: { kind: "REWARD" } }))) await spend(jan);
			expect(await mockPrisma.rewardMonthlyGrant.count()).toBe(1);
			expect(await mockPrisma.rewardMonthlyPolicy.count()).toBe(1);
			expect(await mockPrisma.rewardClaimAllocation.count()).toBe(1);
			expect(await mockPrisma.pointLog.count({ where: { kind: "REWARD" } })).toBe(1);
			expect(await balance(jan)).toMatchObject({ remaining: 0 });
		} finally {
			await second.$disconnect();
		}
	});

	test("failed points checks roll back lazy grants and allocations", async () => {
		await limits([{ period: "MONTH", rolloverEnabled: true }]);
		await settings({ rewardThreshold: 1000 });
		await expect(spend(jan)).rejects.toMatchObject({ message: "Not enough points to claim" });
		expect(await mockPrisma.rewardMonthlyGrant.count()).toBe(0);
		expect(await mockPrisma.rewardMonthlyPolicy.count()).toBe(0);
	});
});

test("legacy echoes preserve IDs and omitted rollover values; stale replacements and removals conflict", async () => {
	const caller = householdCoreRouter.createCaller(callerContext("alice"));
	await caller.updateCurrent({
		householdId: "home",
		rewardClaimRevision: 0,
		rewardClaimLimits: [
			{ maxClaims: 2, period: "MONTH", windowMinutes: null, scope: "HOUSEHOLD", userId: null, rolloverEnabled: true },
		],
	});
	const original = (await caller.getCurrent({ householdId: "home" })).household;
	const id = original.rewardClaimLimits[0].id;
	await caller.updateCurrent({
		householdId: "home",
		name: "Legacy name",
		rewardClaimLimits: [{ maxClaims: 2, period: "MONTH", windowMinutes: null, scope: "HOUSEHOLD", userId: null }],
	});
	expect((await settings()).rewardClaimLimits[0]).toMatchObject({ id, rolloverEnabled: true });
	await caller.updateCurrent({
		householdId: "home",
		rewardClaimRevision: original.rewardClaimRevision,
		rewardClaimLimits: [{ id, maxClaims: 3, period: "MONTH", windowMinutes: null, scope: "HOUSEHOLD", userId: null }],
	});
	expect((await settings()).rewardClaimLimits[0]).toMatchObject({ id, rolloverEnabled: true, maxClaims: 3 });
	await expect(
		caller.updateCurrent({
			householdId: "home",
			name: "Stale name",
			rewardClaimRevision: original.rewardClaimRevision,
			rewardClaimLimits: [],
		}),
	).rejects.toMatchObject({ code: "CONFLICT" });
	await expect(caller.updateCurrent({ householdId: "home", rewardClaimLimits: [] })).rejects.toMatchObject({
		code: "CONFLICT",
	});
	expect((await settings()).name).toBe("Legacy name");
	expect((await settings()).rewardClaimLimits[0].id).toBe(id);
});

test("simultaneous settings saves accept one revision and claims cannot observe partially replaced rules", async () => {
	const caller = householdCoreRouter.createCaller(callerContext("alice"));
	const rule = {
		maxClaims: 1,
		period: "MONTH" as const,
		windowMinutes: null,
		scope: "HOUSEHOLD" as const,
		userId: null,
		rolloverEnabled: true,
	};
	const results = await Promise.allSettled([
		caller.updateCurrent({ householdId: "home", rewardClaimRevision: 0, rewardClaimLimits: [rule] }),
		caller.updateCurrent({
			householdId: "home",
			rewardClaimRevision: 0,
			rewardClaimLimits: [{ ...rule, maxClaims: 2 }],
		}),
	]);
	expect(results.filter((result) => result.status === "fulfilled")).toHaveLength(1);
	const household = await settings();
	expect(household.rewardClaimRevision).toBe(1);
	expect(household.rewardClaimLimits).toHaveLength(1);
	const revision = household.rewardClaimRevision;
	await Promise.allSettled([
		claim(),
		caller.updateCurrent({
			householdId: "home",
			rewardClaimRevision: revision,
			rewardClaimLimits: household.rewardClaimLimits.map((rule) => ({ ...rule, maxClaims: 5 })),
		}),
	]);
	const allowance = await getRewardClaimAllowance(mockPrisma, await settings(), "home", "alice");
	const activeClaims = await mockPrisma.pointLog.count({ where: { kind: "REWARD" } });
	expect(allowance?.rules[0].maxClaims).toBe(household.rewardClaimLimits[0].maxClaims);
	expect(allowance?.remaining).toBe(household.rewardClaimLimits[0].maxClaims - activeClaims);
});

test("the actual reward reversal route releases allocations exactly once", async () => {
	await limits([{ period: "MONTH", maxClaims: 2, rolloverEnabled: true }]);
	const claim = await mockPrisma.$transaction((tx) => claimReward(tx, "alice", "home"));
	const caller = logsRouter.createCaller(callerContext("alice"));
	await caller.updateStatus({ id: claim.entry.id, action: "revert" });
	await expect(caller.updateStatus({ id: claim.entry.id, action: "revert" })).rejects.toMatchObject({
		message: "Already reverted",
	});
	const household = await settings();
	expect(await getRewardClaimAllowance(mockPrisma, household, "home", "alice")).toMatchObject({ remaining: 2 });
	expect((await mockPrisma.rewardClaimAllocation.findFirstOrThrow()).releasedAt).not.toBeNull();
	expect(
		(await mockPrisma.pointLog.aggregate({ where: { userId: "alice", revertedAt: null }, _sum: { points: true } }))._sum
			.points,
	).toBe(500);
});
