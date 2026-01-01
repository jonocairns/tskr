import { redirect } from "next/navigation";
import { getServerSession } from "next-auth";

import { AuthCta } from "@/components/AuthCta";
import { DangerZone } from "@/components/household/DangerZone";
import { InvitesCard } from "@/components/household/InvitesCard";
import { JoinCard } from "@/components/household/JoinCard";
import { MembersCard } from "@/components/household/MembersCard";
import { NotificationsCard } from "@/components/household/NotificationsCard";
import { SettingsCard } from "@/components/household/SettingsCard";
import { PageHeader } from "@/components/PageHeader";
import { PageShell } from "@/components/PageShell";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/Card";
import { authOptions } from "@/lib/auth";
import { isGoogleAuthEnabled } from "@/lib/authConfig";
import { getActiveHouseholdMembership } from "@/lib/households";

export const dynamic = "force-dynamic";

export default async function HouseholdPage() {
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
	const active = await getActiveHouseholdMembership(userId, session.user.householdId ?? null);
	if (!active) {
		redirect("/landing");
	}

	const { householdId, membership } = active;

	return (
		<PageShell size="lg">
			<PageHeader
				eyebrow="tskr"
				title="Household"
				description="Manage settings, members, and invite codes."
				backHref="/"
				backLabel="Back to dashboard"
				user={session.user}
				googleEnabled={googleEnabled}
			/>

			{membership.role === "DICTATOR" && (
				<Card>
					<CardHeader>
						<CardTitle className="text-xl">General</CardTitle>
						<CardDescription>Update household settings and manage deletion.</CardDescription>
					</CardHeader>
					<CardContent className="space-y-8">
						<SettingsCard householdId={householdId} canManage={true} variant="section" />

						<DangerZone canDelete={true} variant="section" />
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
					<CardTitle className="text-xl">Notifications</CardTitle>
					<CardDescription>Manage push notifications and task reminders for your household.</CardDescription>
				</CardHeader>
				<CardContent>
					<NotificationsCard householdId={householdId} userId={userId} canManage={membership.role === "DICTATOR"} />
				</CardContent>
			</Card>

			<InvitesCard householdId={householdId} canInvite={membership.role === "DICTATOR"} />

			<JoinCard />
		</PageShell>
	);
}
