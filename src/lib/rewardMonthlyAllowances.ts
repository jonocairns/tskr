import { Temporal } from "@js-temporal/polyfill";
import type { Prisma, RewardClaimLimit } from "@prisma/client";
import { resolveTimeZone } from "@/lib/timeZones";

type Tx = Prisma.TransactionClient;
const monthAt = (now: Date, zone: string) =>
	Temporal.Instant.fromEpochMilliseconds(now.getTime())
		.toZonedDateTimeISO(resolveTimeZone(zone))
		.toPlainDate()
		.toPlainYearMonth()
		.toString();
const nextMonth = (month: string) => Temporal.PlainYearMonth.from(month).add({ months: 1 }).toString();
const boundary = (month: string, zone: string) =>
	new Date(
		Temporal.PlainYearMonth.from(month).toPlainDate({ day: 1 }).toZonedDateTime(resolveTimeZone(zone))
			.epochMilliseconds,
	);

export const monthlyPolicy = async (tx: Tx, rule: RewardClaimLimit, timeZone: string, now: Date) => {
	let policies = await tx.rewardMonthlyPolicy.findMany({ where: { ruleId: rule.id }, orderBy: { revision: "asc" } });
	if (!policies.length) {
		policies = [
			await tx.rewardMonthlyPolicy.create({
				data: {
					ruleId: rule.id,
					revision: 0,
					effectiveMonth: monthAt(now, timeZone),
					recordedAt: now,
					maxClaims: rule.maxClaims,
					rolloverEnabled: rule.rolloverEnabled,
					timeZone,
				},
			}),
		];
	}
	return policies;
};

// Reconstruct boundaries only from known policy history, including timezone changes.
// A new member uses the same active month as existing accounts, even when the new
// timezone's calendar date is on the other side of their preserved boundary.
const monthWindowAt = (policies: Awaited<ReturnType<typeof monthlyPolicy>>, at: Date) => {
	let month = policies[0].effectiveMonth;
	const policyFor = (value: string) => policies.filter((p) => p.effectiveMonth <= value).at(-1) ?? policies[0];
	let policy = policyFor(month);
	let startsAt = boundary(month, policy.timeZone);
	let endsAt = boundary(nextMonth(month), policy.timeZone);
	while (endsAt <= at) {
		month = nextMonth(month);
		policy = policyFor(month);
		startsAt = endsAt;
		endsAt = boundary(nextMonth(month), policy.timeZone);
	}
	return { month, policy, startsAt, endsAt };
};

const grantInclude = { allocations: { include: { log: { select: { createdAt: true } } } } } as const;
type MonthlyGrant = Prisma.RewardMonthlyGrantGetPayload<{ include: typeof grantInclude }>;
const grantBalance = (grant: MonthlyGrant, at: Date, before = false) => {
	if (grant.expiresAt && grant.expiresAt <= at) return 0;
	const spent = grant.allocations.filter(({ log, releasedAt }) =>
		before ? log.createdAt < at && (releasedAt === null || releasedAt >= at) : releasedAt === null,
	).length;
	return Math.max(0, grant.amount - grant.forfeited - spent);
};

// Run only inside the caller's transaction. The account/month unique key makes grants
// idempotent; SQLite serializes writers (a competing transaction may need retry).
export const advanceMonthlyAccount = async (
	tx: Tx,
	rule: RewardClaimLimit,
	timeZone: string,
	userId: string,
	now: Date,
) => {
	const policies = await monthlyPolicy(tx, rule, timeZone, now);
	const member =
		rule.scope === "MEMBER"
			? await tx.householdMember.findUniqueOrThrow({
					where: { householdId_userId: { householdId: rule.householdId, userId } },
				})
			: null;
	const ownerKey = member?.id ?? "";
	let account = await tx.rewardAllowanceAccount.findUnique({
		where: { ruleId_ownerKey: { ruleId: rule.id, ownerKey } },
	});
	if (!account) {
		const initializedAt = new Date(Math.max(policies[0].recordedAt.getTime(), member?.joinedAt.getTime() ?? 0));
		account = await tx.rewardAllowanceAccount.create({ data: { ruleId: rule.id, ownerKey, initializedAt } });
		const { month, policy, startsAt, endsAt } = monthWindowAt(policies, initializedAt);
		const grant = await tx.rewardMonthlyGrant.create({
			data: {
				accountId: account.id,
				month,
				startsAt,
				endsAt,
				amount: policy.maxClaims,
				rolloverEnabled: policy.rolloverEnabled,
				expiresAt: policy.rolloverEnabled ? null : endsAt,
			},
		});
		// Bootstrap only the known initial month. Keep over-limit allocations as debt;
		// reversals then free exactly a slot, rather than issuing a fresh allowance.
		const logs = await tx.pointLog.findMany({
			where: {
				householdId: rule.householdId,
				...(member ? { userId } : {}),
				kind: "REWARD",
				status: "APPROVED",
				createdAt: {
					gte:
						member && member.joinedAt > policies[0].recordedAt
							? new Date(Math.max(startsAt.getTime(), member.joinedAt.getTime()))
							: startsAt,
					lt: endsAt,
				},
			},
		});
		for (const log of logs) {
			await tx.rewardClaimAllocation.create({ data: { grantId: grant.id, logId: log.id, releasedAt: log.revertedAt } });
		}
	}
	const grants = await tx.rewardMonthlyGrant.findMany({
		where: { accountId: account.id },
		orderBy: { month: "asc" },
		include: grantInclude,
	});
	let last = grants[grants.length - 1];
	while (last.endsAt <= now) {
		const month = nextMonth(last.month);
		const policy = policies.filter((p) => p.effectiveMonth <= month).at(-1) ?? policies[0];
		// Only the departing month's unused units can become newly banked. A lower
		// cap never trims an existing bank, and disabling never destroys that bank.
		if (last.rolloverEnabled) {
			let banked = 0;
			for (const grant of grants.slice(0, -1)) banked += grantBalance(grant, last.endsAt, true);
			const unused = grantBalance(last, last.endsAt, true);
			const kept = Math.min(unused, Math.max(0, (policy.rolloverEnabled ? policy.maxClaims : 0) - banked));
			last = await tx.rewardMonthlyGrant.update({
				where: { id: last.id },
				data: { forfeited: { increment: unused - kept } },
				include: grantInclude,
			});
			grants[grants.length - 1] = last;
		}
		const endsAt = boundary(nextMonth(month), policy.timeZone);
		const grant = await tx.rewardMonthlyGrant.create({
			data: {
				accountId: account.id,
				month,
				startsAt: last.endsAt,
				endsAt,
				amount: policy.maxClaims,
				rolloverEnabled: policy.rolloverEnabled,
				expiresAt: policy.rolloverEnabled ? null : endsAt,
			},
			include: grantInclude,
		});
		grants.push(grant);
		last = grant;
	}
	const available = [];
	for (const grant of grants) {
		// Current availability follows recorded claim/reversal state, including existing
		// future-dated calendar claims. Boundary snapshots use event timestamps instead.
		const remaining = grantBalance(grant, now);
		available.push({ grantId: grant.id, remaining, current: grant.id === last.id });
	}
	return {
		available,
		maxClaims: last.amount,
		changesAt: last.endsAt.toISOString(),
		thisMonth: available.filter((g) => g.current).reduce((sum, g) => sum + g.remaining, 0),
		carried: available.filter((g) => !g.current).reduce((sum, g) => sum + g.remaining, 0),
	};
};

export const initializeMonthlyRule = async (tx: Tx, rule: RewardClaimLimit, timeZone: string, now: Date) => {
	if (rule.scope === "HOUSEHOLD") {
		await advanceMonthlyAccount(tx, rule, timeZone, "", now);
	} else {
		const members = await tx.householdMember.findMany({
			where: { householdId: rule.householdId, ...(rule.userId ? { userId: rule.userId } : {}) },
		});
		// Initialize the policy even when its named member has left.
		await monthlyPolicy(tx, rule, timeZone, now);
		for (const member of members) await advanceMonthlyAccount(tx, rule, timeZone, member.userId, now);
	}
};

export const editMonthlyPolicy = async (
	tx: Tx,
	rule: RewardClaimLimit,
	maxClaims: number,
	rolloverEnabled: boolean,
	timeZone: string,
	now: Date,
	nextTimeZone = timeZone,
) => {
	await initializeMonthlyRule(tx, rule, timeZone, now);
	const policies = await monthlyPolicy(tx, rule, timeZone, now);
	const firstEnable = rolloverEnabled && !policies.some((p) => p.rolloverEnabled);
	const currentGrant = await tx.rewardMonthlyGrant.findFirst({
		where: { account: { ruleId: rule.id }, startsAt: { lte: now }, endsAt: { gt: now } },
		orderBy: { month: "desc" },
	});
	const current = currentGrant?.month ?? monthWindowAt(policies, now).month;
	if (firstEnable) {
		// Initial enablement changes carry treatment, never the original grant amount.
		await tx.rewardMonthlyGrant.updateMany({
			where: { account: { ruleId: rule.id }, month: current },
			data: { rolloverEnabled: true, expiresAt: null },
		});
		await tx.rewardMonthlyPolicy.create({
			data: {
				ruleId: rule.id,
				revision: policies.length,
				effectiveMonth: current,
				recordedAt: now,
				maxClaims: policies.filter((p) => p.effectiveMonth <= current).at(-1)?.maxClaims ?? rule.maxClaims,
				rolloverEnabled: true,
				timeZone: policies.filter((p) => p.effectiveMonth <= current).at(-1)?.timeZone ?? timeZone,
			},
		});
	}
	await tx.rewardMonthlyPolicy.create({
		data: {
			ruleId: rule.id,
			revision: policies.length + (firstEnable ? 1 : 0),
			effectiveMonth: nextMonth(current),
			recordedAt: now,
			maxClaims,
			rolloverEnabled,
			timeZone: nextTimeZone,
		},
	});
};

// Advance before marking the log reverted, so a late reversal cannot rewrite what
// was unused at a past boundary. Historical claims with no allocation get no credit.
export const releaseRewardAllocations = async (
	tx: Tx,
	log: { id: string; householdId: string; userId: string },
	now = new Date(),
) => {
	const household = await tx.household.findUniqueOrThrow({
		where: { id: log.householdId },
		include: { rewardClaimLimits: { where: { archivedAt: null, period: "MONTH" } } },
	});
	for (const rule of household.rewardClaimLimits) {
		if (rule.scope === "HOUSEHOLD") {
			await advanceMonthlyAccount(tx, rule, household.timeZone, log.userId, now);
		} else if (!rule.userId || rule.userId === log.userId) {
			const member = await tx.householdMember.findUnique({
				where: { householdId_userId: { householdId: log.householdId, userId: log.userId } },
			});
			if (member) await advanceMonthlyAccount(tx, rule, household.timeZone, log.userId, now);
		}
	}
	await tx.rewardClaimAllocation.updateMany({ where: { logId: log.id, releasedAt: null }, data: { releasedAt: now } });
};
