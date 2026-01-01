import {
	getActiveHouseholdMembership as getActiveHouseholdMembershipCore,
	type HouseholdMembership,
	type HouseholdRole,
	type HouseholdStore,
	resolveActiveHouseholdId as resolveActiveHouseholdIdCore,
} from "@/lib/householdsCore";
import { prisma } from "@/lib/prisma";

export type { HouseholdMembership, HouseholdRole };

export async function getHouseholdMembership(userId: string, householdId: string): Promise<HouseholdMembership | null> {
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

export async function resolveActiveHouseholdId(userId: string): Promise<string | null> {
	const user = await prisma.user.findUnique({
		where: { id: userId },
		select: { lastHouseholdId: true },
	});

	return resolveActiveHouseholdIdCore(store, userId, user?.lastHouseholdId);
}

export async function getActiveHouseholdMembership(
	userId: string,
): Promise<{ householdId: string; membership: HouseholdMembership } | null> {
	const user = await prisma.user.findUnique({
		where: { id: userId },
		select: { lastHouseholdId: true },
	});

	return getActiveHouseholdMembershipCore(store, userId, user?.lastHouseholdId);
}
