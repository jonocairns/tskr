import { Temporal } from "@js-temporal/polyfill";
import type { Prisma } from "@prisma/client";

import type { RewardClaimRule } from "@/lib/rewardClaimSettings";
import { resolveTimeZone } from "@/lib/timeZones";

export type RewardClaimSettings = {
	rewardClaimLimits: Array<RewardClaimRule & { id: string }>;
	timeZone: string;
};

export type RewardClaimReader = {
	pointLog: {
		findMany: (args: {
			where: Prisma.PointLogWhereInput;
			select: { createdAt: true };
			orderBy: { createdAt: "desc" };
			take: number;
		}) => Promise<Array<{ createdAt: Date }>>;
	};
};

export const getRewardClaimWindow = (
	now: Date,
	period: Exclude<RewardClaimRule["period"], "ROLLING">,
	timeZone: string,
) => {
	const zone = resolveTimeZone(timeZone);
	const zoned = Temporal.Instant.fromEpochMilliseconds(now.getTime()).toZonedDateTimeISO(zone);
	const day = zoned.toPlainDate();
	const start =
		period === "DAY" ? day : period === "WEEK" ? day.subtract({ days: zoned.dayOfWeek - 1 }) : day.with({ day: 1 });
	const end = start.add(period === "MONTH" ? { months: 1 } : { days: period === "WEEK" ? 7 : 1 });
	return {
		start: new Date(start.toZonedDateTime(zone).epochMilliseconds),
		end: new Date(end.toZonedDateTime(zone).epochMilliseconds),
	};
};

export const getRewardClaimAllowance = async (
	client: RewardClaimReader,
	settings: RewardClaimSettings,
	householdId: string,
	userId: string,
	now = new Date(),
) => {
	const applicableRules = settings.rewardClaimLimits.filter(
		(rule) => rule.scope === "HOUSEHOLD" || rule.userId === null || rule.userId === userId,
	);
	if (applicableRules.length === 0) return null;

	const rules = await Promise.all(
		applicableRules.map(async (rule) => {
			const window = rule.period === "ROLLING" ? null : getRewardClaimWindow(now, rule.period, settings.timeZone);
			const durationMs = (rule.windowMinutes ?? 0) * 60000;
			const claims = await client.pointLog.findMany({
				where: {
					householdId,
					...(rule.scope === "MEMBER" ? { userId } : {}),
					kind: "REWARD",
					status: "APPROVED",
					revertedAt: null,
					createdAt: window
						? { gte: window.start, lt: window.end }
						: { gt: new Date(now.getTime() - durationMs), lte: now },
				},
				select: { createdAt: true },
				orderBy: { createdAt: "desc" },
				take: rule.maxClaims,
			});
			// Only the newest maxClaims entries matter, including when a cap was lowered.
			const lastClaim = claims.at(-1);
			const changesAt = window?.end ?? (lastClaim ? new Date(lastClaim.createdAt.getTime() + durationMs) : null);
			return {
				...rule,
				remaining: Math.max(0, rule.maxClaims - claims.length),
				changesAt: changesAt?.toISOString() ?? null,
			};
		}),
	);
	const changes = rules.flatMap((rule) => (rule.changesAt ? [rule.changesAt] : [])).sort();
	return { remaining: Math.min(...rules.map((rule) => rule.remaining)), changesAt: changes[0] ?? null, rules };
};
