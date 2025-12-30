import { redirect } from "next/navigation";
import { getServerSession } from "next-auth";

import { AuthCta } from "@/components/AuthCta";
import { DangerZone } from "@/components/household/DangerZone";
import { InvitesCard } from "@/components/household/InvitesCard";
import { MembersCard } from "@/components/household/MembersCard";
import { SettingsCard } from "@/components/household/SettingsCard";
import { PageHeader } from "@/components/PageHeader";
import { PageShell } from "@/components/PageShell";
import { PushNotifications } from "@/components/PushNotifications";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/Card";
import { authOptions } from "@/lib/auth";
import { isGoogleAuthEnabled } from "@/lib/authConfig";
import { getHouseholdMembership } from "@/lib/households";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

type Props = {
	params: { id: string };
};

export default async function HouseholdDetailPage({ params }: Props) {
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
	const membership = await getHouseholdMembership(userId, params.id);
	if (!membership) {
		redirect("/household");
	}

	if (session.user.householdId !== params.id) {
		await prisma.user.update({
			where: { id: userId },
			data: { lastHouseholdId: params.id },
		});
	}

	return (
		<PageShell size="lg">
			<PageHeader
				eyebrow="tskr"
				title="Household"
				description="Manage settings, members, and invite codes."
				backHref="/household"
				backLabel="Back to households"
				user={session.user}
				googleEnabled={googleEnabled}
			/>

			<Card>
				<CardHeader>
					<CardTitle className="text-xl">General</CardTitle>
					<CardDescription>Update household settings, notifications, and manage deletion.</CardDescription>
				</CardHeader>
				<CardContent className="space-y-8">
					<SettingsCard householdId={params.id} canManage={membership.role === "DICTATOR"} variant="section" />

					<PushNotifications variant="section" />

					<DangerZone householdId={params.id} canDelete={membership.role === "DICTATOR"} variant="section" />
				</CardContent>
			</Card>

			{membership.role !== "DOER" ? (
				<MembersCard
					householdId={params.id}
					currentUserId={userId}
					canManageMembers={membership.role === "DICTATOR"}
				/>
			) : null}

			<InvitesCard householdId={params.id} canInvite={membership.role === "DICTATOR"} />
		</PageShell>
	);
}
