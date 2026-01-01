import { redirect } from "next/navigation";
import { getServerSession } from "next-auth";
import type { ReactNode } from "react";

import { authOptions } from "@/lib/auth";
import { getActiveHouseholdMembership, getHouseholdMembership } from "@/lib/households";
import { prisma } from "@/lib/prisma";

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

	// Validate user has access to requested household
	const membership = await getHouseholdMembership(userId, requestedHouseholdId);

	if (!membership) {
		// Not a member - redirect to their actual household or landing
		const active = await getActiveHouseholdMembership(userId, session.user.householdId ?? null);

		if (active) {
			redirect(`/${active.householdId}`);
		}
		redirect("/landing");
	}

	// Sync lastHouseholdId with URL (makes it sticky for next visit)
	// Only update if different to avoid unnecessary writes
	if (requestedHouseholdId !== session.user.householdId) {
		await prisma.user.update({
			where: { id: userId },
			data: { lastHouseholdId: requestedHouseholdId },
		});
	}

	return children;
}
