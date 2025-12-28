export type HouseholdRole = "DICTATOR" | "APPROVER" | "DOER";

export type HouseholdMembership = {
	householdId: string;
	role: HouseholdRole;
	requiresApprovalDefault: boolean;
};

export type HouseholdStore = {
	getMembership: (userId: string, householdId: string) => Promise<HouseholdMembership | null>;
	getFirstMembership: (userId: string) => Promise<{ householdId: string } | null>;
};

export async function resolveActiveHouseholdId(
	store: HouseholdStore,
	userId: string,
	lastHouseholdId?: string | null,
): Promise<string | null> {
	if (lastHouseholdId) {
		const membership = await store.getMembership(userId, lastHouseholdId);
		if (membership) {
			return membership.householdId;
		}
	}

	const fallback = await store.getFirstMembership(userId);

	return fallback?.householdId ?? null;
}

export async function getActiveHouseholdMembership(
	store: HouseholdStore,
	userId: string,
	lastHouseholdId?: string | null,
): Promise<{ householdId: string; membership: HouseholdMembership } | null> {
	const householdId = await resolveActiveHouseholdId(store, userId, lastHouseholdId);
	if (!householdId) {
		return null;
	}

	const membership = await store.getMembership(userId, householdId);
	if (!membership) {
		return null;
	}

	return { householdId, membership };
}
