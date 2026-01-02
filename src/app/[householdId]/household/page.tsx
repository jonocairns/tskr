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
	const { session, userId, membership } = await getHouseholdContext(householdId);

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
				household={{ id: householdId, role: membership.role }}
			/>

			{membership.role === "DICTATOR" && (
				<Card>
					<CardHeader>
						<CardTitle className="text-xl">General</CardTitle>
						<CardDescription>Update household settings and manage deletion.</CardDescription>
					</CardHeader>
					<CardContent className="space-y-8">
						<SettingsCard householdId={householdId} canManage={true} variant="section" />

						<DangerZone householdId={householdId} canDelete={membership.role === "DICTATOR"} variant="section" />
					</CardContent>
				</Card>
			)}

			{membership.role !== "DOER" ? (
				<MembersCard
					householdId={householdId}
					currentUserId={userId}
					canManageMembers={membership.role === "DICTATOR"}
				/>
			) : null}

			<Card>
				<CardHeader>
					<div className="flex items-start justify-between gap-4">
						<div className="space-y-1.5">
							<CardTitle className="text-xl">Notifications</CardTitle>
							<CardDescription>Manage push notifications and task reminders for your household.</CardDescription>
						</div>
						<PushNotifications householdId={householdId} variant="section" />
					</div>
				</CardHeader>
			</Card>

			<InvitesCard householdId={householdId} canInvite={membership.role === "DICTATOR"} />

			<JoinCard />
		</PageShell>
	);
}
