import "server-only";

import { redirect } from "next/navigation";
import type { Session } from "next-auth";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { getActiveHouseholdMembership, getHouseholdMembership, type HouseholdMembership } from "@/lib/households";

export type AuthenticatedSession = Session & {
	user: NonNullable<Session["user"]> & {
		id: string;
	};
};

export type HouseholdContext = {
	session: AuthenticatedSession;
	userId: string;
	householdId: string;
	membership: HouseholdMembership;
};

export async function getHouseholdContext(householdId: string): Promise<HouseholdContext> {
	const session = await getServerSession(authOptions);

	if (!session?.user?.id) {
		redirect("/");
	}

	const userId = session.user.id;
	const membership = await getHouseholdMembership(userId, householdId);

	if (!membership) {
		const active = await getActiveHouseholdMembership(userId);
		if (active) {
			redirect(`/${active.householdId}?error=HouseholdAccessDenied`);
		}
		redirect("/landing?error=NoHouseholdMembership");
	}

	return {
		session: session as AuthenticatedSession,
		userId,
		householdId,
		membership,
	};
}
