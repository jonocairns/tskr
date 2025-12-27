import {
	type HouseholdMembership,
	type HouseholdRole,
	type HouseholdStore,
	getActiveHouseholdMembership as getActiveHouseholdMembershipCore,
	resolveActiveHouseholdId as resolveActiveHouseholdIdCore,
} from "@/lib/households-core";
import { prisma } from "@/lib/prisma";

export type { HouseholdMembership, HouseholdRole };

export async function getHouseholdMembership(
	userId: string,
	householdId: string,
): Promise<HouseholdMembership | null> {
	return prisma.householdMember.findFirst({
		where: { userId, householdId },
		select: { householdId: true, role: true, requiresApprovalDefault: true },
	});
}

const store: HouseholdStore = {
	getMembership: getHouseholdMembership,
	getFirstMembership: (userId: string) =>
		prisma.householdMember.findFirst({
			where: { userId },
			select: { householdId: true },
			orderBy: { joinedAt: "asc" },
		}),
};

export async function resolveActiveHouseholdId(
	userId: string,
	lastHouseholdId?: string | null,
): Promise<string | null> {
	return resolveActiveHouseholdIdCore(store, userId, lastHouseholdId);
}

export async function getActiveHouseholdMembership(
	userId: string,
	lastHouseholdId?: string | null,
): Promise<{ householdId: string; membership: HouseholdMembership } | null> {
	return getActiveHouseholdMembershipCore(store, userId, lastHouseholdId);
}
