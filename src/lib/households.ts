import { prisma } from "@/lib/prisma";

export type HouseholdRole = "DICTATOR" | "APPROVER" | "DOER";

export type HouseholdMembership = {
	householdId: string;
	role: HouseholdRole;
	requiresApprovalDefault: boolean;
};

export async function getHouseholdMembership(
	userId: string,
	householdId: string,
): Promise<HouseholdMembership | null> {
	return prisma.householdMember.findFirst({
		where: { userId, householdId },
		select: { householdId: true, role: true, requiresApprovalDefault: true },
	});
}

export async function resolveActiveHouseholdId(
	userId: string,
	lastHouseholdId?: string | null,
): Promise<string | null> {
	if (lastHouseholdId) {
		const membership = await getHouseholdMembership(userId, lastHouseholdId);
		if (membership) {
			return membership.householdId;
		}
	}

	const fallback = await prisma.householdMember.findFirst({
		where: { userId },
		select: { householdId: true },
		orderBy: { joinedAt: "asc" },
	});

	return fallback?.householdId ?? null;
}

export async function ensureActiveHouseholdId(
	userId: string,
	lastHouseholdId?: string | null,
): Promise<string | null> {
	const resolvedId = await resolveActiveHouseholdId(userId, lastHouseholdId);
	if (resolvedId) {
		if (!lastHouseholdId || lastHouseholdId !== resolvedId) {
			await prisma.user.update({
				where: { id: userId },
				data: { lastHouseholdId: resolvedId },
			});
		}
		return resolvedId;
	}

	const user = await prisma.user.findUnique({
		where: { id: userId },
		select: { name: true, email: true },
	});
	const householdName = user?.name ?? user?.email ?? "Household";
	const household = await prisma.household.create({
		data: {
			name: householdName,
			createdById: userId,
			members: {
				create: {
					userId,
					role: "DICTATOR",
					requiresApprovalDefault: false,
				},
			},
		},
		select: { id: true },
	});

	await prisma.user.update({
		where: { id: userId },
		data: { lastHouseholdId: household.id },
	});

	return household.id;
}

export async function getActiveHouseholdMembership(
	userId: string,
	lastHouseholdId?: string | null,
): Promise<{ householdId: string; membership: HouseholdMembership } | null> {
	const householdId = await ensureActiveHouseholdId(userId, lastHouseholdId);
	if (!householdId) {
		return null;
	}

	const membership = await getHouseholdMembership(userId, householdId);
	if (!membership) {
		return null;
	}

	return { householdId, membership };
}
