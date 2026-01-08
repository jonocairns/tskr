import { createFileRoute } from "@tanstack/react-router";

import { DangerZone } from "@/components/household/DangerZone";
import { InvitesCard } from "@/components/household/InvitesCard";
import { JoinCard } from "@/components/household/JoinCard";
import { MembersCard } from "@/components/household/MembersCard";
import { SettingsCard } from "@/components/household/SettingsCard";
import { PageHeader } from "@/components/PageHeader";
import { PageShell } from "@/components/PageShell";
import { PushNotifications } from "@/components/PushNotifications";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/Card";

import type { HouseholdContext } from "../_layout";

export const Route = createFileRoute("/$householdId/_layout/household")({
	loader: ({ context }) => {
		const { householdContext } = context as { householdContext: HouseholdContext };
		return { householdContext };
	},
	component: HouseholdPage,
});

function HouseholdPage() {
	const data = Route.useLoaderData();
	const { householdContext } = data;

	return (
		<PageShell size="lg">
			<PageHeader
				eyebrow="tskr"
				title="Household"
				description="Manage settings, members, and invite codes."
				backHref={`/${householdContext.householdId}`}
				backLabel="Back to dashboard"
				user={householdContext.session.user}
				household={{ id: householdContext.householdId, role: householdContext.membership.role }}
			/>

			{householdContext.membership.role === "DICTATOR" && (
				<Card>
					<CardHeader>
						<CardTitle className="text-xl">General</CardTitle>
						<CardDescription>Update household settings and manage deletion.</CardDescription>
					</CardHeader>
					<CardContent className="space-y-8">
						<SettingsCard householdId={householdContext.householdId} canManage={true} variant="section" />

						<DangerZone
							householdId={householdContext.householdId}
							canDelete={householdContext.membership.role === "DICTATOR"}
							variant="section"
						/>
					</CardContent>
				</Card>
			)}

			{householdContext.membership.role !== "DOER" ? (
				<MembersCard
					householdId={householdContext.householdId}
					currentUserId={householdContext.userId}
					canManageMembers={householdContext.membership.role === "DICTATOR"}
				/>
			) : null}

			<Card>
				<CardHeader>
					<div className="flex items-start justify-between gap-4">
						<div className="space-y-1.5">
							<CardTitle className="text-xl">Notifications</CardTitle>
							<CardDescription>Manage push notifications and task reminders for your household.</CardDescription>
						</div>
						<PushNotifications householdId={householdContext.householdId} variant="section" />
					</div>
				</CardHeader>
			</Card>

			<InvitesCard
				householdId={householdContext.householdId}
				canInvite={householdContext.membership.role === "DICTATOR"}
			/>

			<JoinCard />
		</PageShell>
	);
}
