import { redirect } from "next/navigation";
import { getServerSession } from "next-auth";
import type { ReactNode } from "react";

import { authOptions } from "@/lib/auth";
import { getActiveHouseholdMembership, getHouseholdMembership } from "@/lib/households";

export default async function HouseholdLayout({
	children,
	params,
}: {
	children: ReactNode;
	params: Promise<{ householdId: string }>;
}) {
	const session = await getServerSession(authOptions);

	if (!session?.user?.id) {
		redirect("/");
	}

	const userId = session.user.id;
	const { householdId: requestedHouseholdId } = await params;

	const membership = await getHouseholdMembership(userId, requestedHouseholdId);

	if (!membership) {
		const active = await getActiveHouseholdMembership(userId);

		if (active) {
			redirect(`/${active.householdId}`);
		}
		redirect("/landing");
	}
	return children;
}
