import { getServerSession } from "next-auth";

import { DangerZone } from "@/components/household/DangerZone";
import { InvitesCard } from "@/components/household/InvitesCard";
import { JoinCard } from "@/components/household/JoinCard";
import { MembersCard } from "@/components/household/MembersCard";
import { SettingsCard } from "@/components/household/SettingsCard";
import { PageHeader } from "@/components/PageHeader";
import { PageShell } from "@/components/PageShell";
import { PushNotifications } from "@/components/PushNotifications";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/Card";
import { authOptions } from "@/lib/auth";
import { isGoogleAuthEnabled } from "@/lib/authConfig";
import { getHouseholdMembership } from "@/lib/households";

export const dynamic = "force-dynamic";

type Props = {
	params: Promise<{ householdId: string }>;
};

export default async function HouseholdPage({ params }: Props) {
	const googleEnabled = isGoogleAuthEnabled;
	const session = await getServerSession(authOptions);

	// Layout handles auth check - session will always exist here
	if (!session?.user?.id) {
		throw new Error("Unauthorized");
	}

	const userId = session.user.id;
	const { householdId } = await params;

	// Get membership for role info
	const membership = await getHouseholdMembership(userId, householdId);

	if (!membership) {
		throw new Error("Membership not found");
	}

	return (
		<PageShell size="lg">
			<PageHeader
				eyebrow="tskr"
				title="Household"
				description="Manage settings, members, and invite codes."
				backHref={`/${householdId}`}
				backLabel="Back to dashboard"
				user={session.user}
				googleEnabled={googleEnabled}
			/>

			<Card>
				<CardHeader>
					<CardTitle className="text-xl">General</CardTitle>
					<CardDescription>Update household settings, notifications, and manage deletion.</CardDescription>
				</CardHeader>
				<CardContent className="space-y-8">
					<SettingsCard householdId={householdId} canManage={membership.role === "DICTATOR"} variant="section" />

					<PushNotifications variant="section" />

					<DangerZone canDelete={membership.role === "DICTATOR"} variant="section" />
				</CardContent>
			</Card>

			{membership.role !== "DOER" ? (
				<MembersCard
					householdId={householdId}
					currentUserId={userId}
					canManageMembers={membership.role === "DICTATOR"}
				/>
			) : null}

			<InvitesCard householdId={householdId} canInvite={membership.role === "DICTATOR"} />

			<JoinCard />
		</PageShell>
	);
}
