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
import { claimRouter } from "@/server/routers/claim";
import { householdCoreRouter } from "@/server/routers/households/core";

const directory = mkdtempSync(join(tmpdir(), "tskr-rewards-"));
const databaseUrl = `file:${join(directory, "test.db")}`;
const mockPrisma = new PrismaClient({ adapter: new PrismaBetterSqlite3({ url: databaseUrl }) });
const claim = (userId = "alice") => mockPrisma.$transaction((tx) => claimReward(tx, userId, "home"));
const settings = (data: Prisma.HouseholdUpdateInput = {}) =>
	mockPrisma.household.update({
		where: { id: "home" },
		data,
		include: { rewardClaimLimits: { orderBy: { sortOrder: "asc" } } },
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
	await caller.updateCurrent({ householdId: "home", rewardClaimLimits: [] });
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
