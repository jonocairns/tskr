import { createFileRoute, Outlet, redirect } from "@tanstack/react-router";
import { createServerFn } from "@tanstack/react-start";
import { getRequestHeaders } from "@tanstack/react-start/server";

import { auth, type Session } from "@/auth/auth";
import { getActiveHouseholdMembership, getHouseholdMembership, type HouseholdMembership } from "@/lib/households";

export type HouseholdContext = {
	session: {
		user: {
			id: string;
			name: string | null;
			email: string | null;
			image: string | null;
			isSuperAdmin: boolean;
		};
	};
	userId: string;
	householdId: string;
	membership: HouseholdMembership;
};

const validateHouseholdAccess = createServerFn({ method: "GET" })
	.inputValidator((data: { householdId: string; cachedSession?: Session | null }) => data)
	.handler(async ({ data: { householdId, cachedSession } }): Promise<HouseholdContext> => {
		// Use cached session if available, otherwise fetch fresh
		let session = cachedSession;
		if (!session) {
			const headers = getRequestHeaders();
			session = await auth.api.getSession({ headers });
		}

		if (!session?.user?.id) {
			throw redirect({ to: "/", search: { error: undefined } });
		}

		const userId = session.user.id;
		const membership = await getHouseholdMembership(userId, householdId);

		if (!membership) {
			const active = await getActiveHouseholdMembership(userId);
			if (active) {
				throw redirect({
					to: "/$householdId",
					params: { householdId: active.householdId },
					search: { error: "HouseholdAccessDenied" },
				});
			}
			throw redirect({ to: "/landing", search: { error: "NoHouseholdMembership" } });
		}

		return {
			session: {
				user: {
					id: session.user.id,
					name: session.user.name ?? null,
					email: session.user.email ?? null,
					image: session.user.image ?? null,
					isSuperAdmin: (session.user as { isSuperAdmin?: boolean }).isSuperAdmin ?? false,
				},
			},
			userId,
			householdId,
			membership,
		};
	});

export const Route = createFileRoute("/$householdId/_layout")({
	beforeLoad: async ({ params, context }) => {
		// Pass the session from root context to avoid re-fetching
		const rootSession = (context as { session?: Session | null }).session;
		const householdContext = await validateHouseholdAccess({
			data: { householdId: params.householdId, cachedSession: rootSession },
		});
		return { householdContext };
	},
	component: HouseholdLayout,
});

function HouseholdLayout() {
	return <Outlet />;
}
