import { DangerZone } from "@/components/household/DangerZone";
import { InvitesCard } from "@/components/household/InvitesCard";
import { JoinCard } from "@/components/household/JoinCard";
import { MembersCard } from "@/components/household/MembersCard";
import { SettingsCard } from "@/components/household/SettingsCard";
import { PageHeader } from "@/components/PageHeader";
import { PageShell } from "@/components/PageShell";
import { PushNotifications } from "@/components/PushNotifications";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/Card";
import { isGoogleAuthEnabled } from "@/lib/authConfig";
import { getHouseholdContext } from "@/lib/serverAuth";

export const dynamic = "force-dynamic";

type Props = {
	params: Promise<{ householdId: string }>;
};

export default async function HouseholdPage({ params }: Props) {
	const googleEnabled = isGoogleAuthEnabled;
	const { householdId } = await params;
	const ctx = await getHouseholdContext(householdId);

	if (!ctx) {
		throw new Error("Unauthorized or membership not found");
	}

	const { session, userId, membership } = ctx;

	return (
		<PageShell size="lg">
			<PageHeader
				eyebrow="tskr"
				title="Household"
				description="Manage settings, members, and invite codes."
				backHref={`/${householdId}`}
				backLabel="Back to dashboard"
				householdId={householdId}
				user={session.user}
				googleEnabled={googleEnabled}
				household={{ id: householdId, role: membership.role }}
			/>

			<Card>
				<CardHeader>
					<CardTitle className="text-xl">General</CardTitle>
					<CardDescription>Update household settings, notifications, and manage deletion.</CardDescription>
				</CardHeader>
				<CardContent className="space-y-8">
					<SettingsCard householdId={householdId} canManage={membership.role === "DICTATOR"} variant="section" />

					<PushNotifications householdId={householdId} variant="section" />

					<DangerZone householdId={householdId} canDelete={membership.role === "DICTATOR"} variant="section" />
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
