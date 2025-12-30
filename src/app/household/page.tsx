import { getServerSession } from "next-auth";

import { AuthCta } from "@/components/AuthCta";
import { CreateCard } from "@/components/household/CreateCard";
import { HouseholdDirectory } from "@/components/household/HouseholdDirectory";
import { JoinCard } from "@/components/household/JoinCard";
import { PageHeader } from "@/components/PageHeader";
import { PageShell } from "@/components/PageShell";
import { authOptions } from "@/lib/auth";
import { isGoogleAuthEnabled } from "@/lib/authConfig";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

export default async function HouseholdListPage() {
	const googleEnabled = isGoogleAuthEnabled;
	const session = await getServerSession(authOptions);

	if (!session?.user?.id) {
		return (
			<PageShell layout="centered" size="lg">
				<AuthCta googleEnabled={googleEnabled} />
			</PageShell>
		);
	}

	const userId = session.user.id;

	const memberships = await prisma.householdMember.findMany({
		where: { userId },
		select: {
			householdId: true,
			role: true,
			joinedAt: true,
			household: {
				select: {
					name: true,
					createdById: true,
				},
			},
		},
		orderBy: { joinedAt: "asc" },
	});

	const householdIds = memberships.map((membership) => membership.householdId);
	const dictatorCounts = householdIds.length
		? await prisma.householdMember.groupBy({
				by: ["householdId"],
				where: { householdId: { in: householdIds }, role: "DICTATOR" },
				_count: { _all: true },
			})
		: [];

	const dictatorCountByHousehold = new Map(
		dictatorCounts.map((entry) => [entry.householdId, entry._count._all]),
	);

	const households = memberships.map((membership) => ({
		id: membership.householdId,
		name: membership.household.name,
		role: membership.role,
		isOwner: membership.household.createdById === userId,
		isActive: session.user.householdId === membership.householdId,
		isLastDictator:
			membership.role === "DICTATOR" && (dictatorCountByHousehold.get(membership.householdId) ?? 0) <= 1,
	}));

	return (
		<PageShell size="lg">
			<PageHeader
				eyebrow="tskr"
				title="Households"
				description="Manage memberships, invites, and ownership."
				backHref="/"
				backLabel="Back to dashboard"
				user={session.user}
				googleEnabled={googleEnabled}
			/>

			<HouseholdDirectory households={households} currentUserId={userId} />

			<div className="grid gap-6 md:grid-cols-2">
				<JoinCard />
				<CreateCard />
			</div>
		</PageShell>
	);
}
