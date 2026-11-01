import type { Prisma } from "@prisma/client";
import { TRPCError } from "@trpc/server";
import type { RewardClaimRule } from "@/lib/rewardClaimSettings";
import { editMonthlyPolicy, initializeMonthlyRule } from "@/lib/rewardMonthlyAllowances";

const conflict = () =>
	new TRPCError({ code: "CONFLICT", message: "Reward limits changed. Reload household settings before saving." });
const sameLegacyRule = (a: RewardClaimRule, b: RewardClaimRule) =>
	a.maxClaims === b.maxClaims &&
	a.period === b.period &&
	a.windowMinutes === b.windowMinutes &&
	a.scope === b.scope &&
	a.userId === b.userId;

export const saveRewardClaimSettings = async (
	tx: Prisma.TransactionClient,
	householdId: string,
	rules: RewardClaimRule[] | undefined,
	revision: number | undefined,
	timeZone: string | undefined,
	now = new Date(),
) => {
	const household = await tx.household.findUniqueOrThrow({
		where: { id: householdId },
		include: { rewardClaimLimits: { where: { archivedAt: null }, orderBy: { sortOrder: "asc" } } },
	});
	const existing = household.rewardClaimLimits;
	const zone = timeZone ?? household.timeZone;
	const hasMonthly = existing.some((rule) => rule.period === "MONTH");
	if (!rules && (zone === household.timeZone || !hasMonthly)) return;
	if (revision === undefined) {
		// Old clients can echo unchanged rules without IDs or new optional fields.
		// They cannot prove that a replacement/removal is based on current settings.
		const unchanged =
			rules === undefined ||
			(rules.length === existing.length &&
				rules.every(
					(rule, index) =>
						sameLegacyRule(rule, existing[index]) &&
						(rule.id === undefined || rule.id === existing[index].id) &&
						(rule.rolloverEnabled === undefined || rule.rolloverEnabled === existing[index].rolloverEnabled),
				));
		if (
			(existing.length || household.rewardClaimRevision > 0) &&
			(!unchanged || (hasMonthly && zone !== household.timeZone))
		)
			throw conflict();
		if (unchanged && (zone === household.timeZone || !hasMonthly)) return;
	} else if (revision !== household.rewardClaimRevision) throw conflict();

	const locked = await tx.household.updateMany({
		where: { id: householdId, rewardClaimRevision: household.rewardClaimRevision },
		data: { rewardClaimRevision: { increment: 1 } },
	});
	if (locked.count !== 1) throw conflict();
	const requested = rules ?? existing;
	const userIds = [...new Set(requested.flatMap((rule) => (rule.userId ? [rule.userId] : [])))];
	if ((await tx.householdMember.count({ where: { householdId, userId: { in: userIds } } })) !== userIds.length) {
		throw new TRPCError({ code: "BAD_REQUEST", message: "Reward limits must target current household members" });
	}
	const used = new Set<string>();
	for (const [sortOrder, requestedRule] of requested.entries()) {
		const previous = requestedRule.id
			? existing.find((rule) => rule.id === requestedRule.id)
			: existing.find((rule) => !used.has(rule.id) && sameLegacyRule(rule, requestedRule));
		if (requestedRule.id && (!previous || used.has(previous.id))) throw conflict();
		if (previous) used.add(previous.id);
		const sameIdentity =
			previous &&
			previous.scope === requestedRule.scope &&
			previous.userId === requestedRule.userId &&
			previous.period === requestedRule.period;
		const { id: _id, ...fields } = requestedRule;
		const rolloverEnabled = requestedRule.rolloverEnabled ?? previous?.rolloverEnabled ?? false;
		if (sameIdentity) {
			if (
				previous.period === "MONTH" &&
				(previous.maxClaims !== fields.maxClaims ||
					previous.rolloverEnabled !== rolloverEnabled ||
					zone !== household.timeZone)
			) {
				await editMonthlyPolicy(tx, previous, fields.maxClaims, rolloverEnabled, household.timeZone, now, zone);
			}
			await tx.rewardClaimLimit.update({ where: { id: previous.id }, data: { ...fields, rolloverEnabled, sortOrder } });
		} else {
			if (previous) await tx.rewardClaimLimit.update({ where: { id: previous.id }, data: { archivedAt: now } });
			const created = await tx.rewardClaimLimit.create({
				data: { ...fields, rolloverEnabled, householdId, sortOrder },
			});
			if (created.period === "MONTH") await initializeMonthlyRule(tx, created, zone, now);
		}
	}
	for (const rule of existing) {
		if (!used.has(rule.id)) await tx.rewardClaimLimit.update({ where: { id: rule.id }, data: { archivedAt: now } });
	}
};
