import {
	getActiveHouseholdMembership,
	type HouseholdMembership,
	type HouseholdStore,
	resolveActiveHouseholdId,
} from "../src/lib/households-core";

const makeStore = (memberships: HouseholdMembership[]) => {
	const membershipMap = new Map(
		memberships.map((membership) => [membership.householdId, membership]),
	);

	const store: HouseholdStore = {
		getMembership: async (_userId, householdId) =>
			membershipMap.get(householdId) ?? null,
		getFirstMembership: async () =>
			memberships[0] ? { householdId: memberships[0].householdId } : null,
	};

	return { store };
};

test("keeps last household when membership exists", async () => {
	const { store } = makeStore([
		{
			householdId: "house-1",
			role: "DOER",
			requiresApprovalDefault: false,
		},
	]);

	const resolved = await resolveActiveHouseholdId(store, "user-1", "house-1");

	expect(resolved).toBe("house-1");
});

test("falls back to first membership when last household is invalid", async () => {
	const { store } = makeStore([
		{
			householdId: "house-2",
			role: "APPROVER",
			requiresApprovalDefault: true,
		},
	]);

	const resolved = await resolveActiveHouseholdId(store, "user-1", "missing");

	expect(resolved).toBe("house-2");
});

test("returns null when no memberships exist", async () => {
	const { store } = makeStore([]);

	const resolved = await resolveActiveHouseholdId(store, "user-1", null);

	expect(resolved).toBeNull();
});

test("returns active membership details when available", async () => {
	const { store } = makeStore([
		{
			householdId: "house-1",
			role: "DICTATOR",
			requiresApprovalDefault: false,
		},
	]);

	const result = await getActiveHouseholdMembership(store, "user-1", "house-1");

	expect(result?.householdId).toBe("house-1");
	expect(result?.membership.role).toBe("DICTATOR");
});

test("returns null when resolved membership is missing", async () => {
	const store: HouseholdStore = {
		getMembership: async () => null,
		getFirstMembership: async () => ({ householdId: "house-1" }),
	};

	const result = await getActiveHouseholdMembership(store, "user-1", null);

	expect(result).toBeNull();
});
