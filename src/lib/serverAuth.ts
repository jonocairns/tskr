import "server-only";

import type { Session } from "next-auth";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { getHouseholdMembership, type HouseholdMembership } from "@/lib/households";

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

export async function getHouseholdContext(householdId: string): Promise<HouseholdContext | null> {
	const session = await getServerSession(authOptions);

	if (!session?.user?.id) {
		return null;
	}

	const userId = session.user.id;
	const membership = await getHouseholdMembership(userId, householdId);

	if (!membership) {
		return null;
	}

	return {
		session: session as AuthenticatedSession,
		userId,
		householdId,
		membership,
	};
}
