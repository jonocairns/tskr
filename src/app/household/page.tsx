import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";

import { AuthCta } from "@/components/AuthCta";
import { HouseholdDangerZone } from "@/components/HouseholdDangerZone";
import { HouseholdInvitesCard } from "@/components/HouseholdInvitesCard";
import { HouseholdJoinCard } from "@/components/HouseholdJoinCard";
import { HouseholdMembersCard } from "@/components/HouseholdMembersCard";
import { HouseholdSettingsCard } from "@/components/HouseholdSettingsCard";
import { PageHeader } from "@/components/PageHeader";
import { PushNotifications } from "@/components/PushNotifications";
import {
	Card,
	CardContent,
	CardDescription,
	CardHeader,
	CardTitle,
} from "@/components/ui/Card";
import { authOptions } from "@/lib/auth";
import { getActiveHouseholdMembership } from "@/lib/households";

export const dynamic = "force-dynamic";

export default async function HouseholdPage() {
	const session = await getServerSession(authOptions);

	if (!session?.user?.id) {
		return (
			<main className="flex min-h-screen items-center bg-gradient-to-br from-background via-background to-muted px-4 py-12">
				<AuthCta />
			</main>
		);
	}

	const userId = session.user.id;
	const active = await getActiveHouseholdMembership(
		userId,
		session.user.householdId ?? null,
	);
	if (!active) {
		redirect("/landing");
	}

	const { householdId, membership } = active;

	return (
		<main className="min-h-screen bg-gradient-to-br from-background via-background to-muted">
			<div className="mx-auto flex max-w-4xl flex-col gap-6 px-4 py-10">
				<PageHeader
					eyebrow="tskr"
					title="Household management"
					description="Manage settings, members, and invite codes."
					backHref="/"
					backLabel="Back to dashboard"
					user={session.user}
				/>

				<Card>
					<CardHeader>
						<CardTitle className="text-xl">General</CardTitle>
						<CardDescription>
							Update household settings, notifications, and manage deletion.
						</CardDescription>
					</CardHeader>
					<CardContent className="space-y-8">
						<HouseholdSettingsCard
							householdId={householdId}
							canManage={membership.role === "DICTATOR"}
							variant="section"
						/>

						<PushNotifications variant="section" />

						<HouseholdDangerZone
							canDelete={membership.role === "DICTATOR"}
							variant="section"
						/>
					</CardContent>
				</Card>

				{membership.role !== "DOER" ? (
					<HouseholdMembersCard
						householdId={householdId}
						currentUserId={userId}
						canManageMembers={membership.role === "DICTATOR"}
					/>
				) : null}

				<HouseholdInvitesCard
					householdId={householdId}
					canInvite={membership.role === "DICTATOR"}
				/>

				<HouseholdJoinCard />
			</div>
		</main>
	);
}
