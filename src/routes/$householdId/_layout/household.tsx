import { createFileRoute } from "@tanstack/react-router";
import { createServerFn } from "@tanstack/react-start";
import { getRequestHeaders } from "@tanstack/react-start/server";

import { auth } from "@/auth/auth";
import { DangerZone } from "@/components/household/DangerZone";
import { InvitesCard } from "@/components/household/InvitesCard";
import { JoinCard } from "@/components/household/JoinCard";
import { MembersCard } from "@/components/household/MembersCard";
import { SettingsCard } from "@/components/household/SettingsCard";
import { PageHeader } from "@/components/PageHeader";
import { PageShell } from "@/components/PageShell";
import { PushNotifications } from "@/components/PushNotifications";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/Card";
import { getHouseholdMembership } from "@/lib/households";

const loadHousehold = createServerFn({ method: "GET" })
	.inputValidator((data: { householdId: string }) => data)
	.handler(async ({ data: { householdId } }) => {
		const headers = getRequestHeaders();
		const session = await auth.api.getSession({ headers });

		if (!session?.user?.id) {
			throw new Error("Unauthorized");
		}

		const userId = session.user.id;
		const membership = await getHouseholdMembership(userId, householdId);

		if (!membership) {
			throw new Error("Not a member");
		}

		return {
			session: {
				user: {
					id: session.user.id,
					name: session.user.name,
					email: session.user.email,
					image: session.user.image,
				},
			},
			userId,
			householdId,
			membership,
		};
	});

export const Route = createFileRoute("/$householdId/_layout/household")({
	loader: ({ params }) => loadHousehold({ data: { householdId: params.householdId } }),
	component: HouseholdPage,
});

function HouseholdPage() {
	const data = Route.useLoaderData();

	return (
		<PageShell size="lg">
			<PageHeader
				eyebrow="tskr"
				title="Household"
				description="Manage settings, members, and invite codes."
				backHref={`/${data.householdId}`}
				backLabel="Back to dashboard"
				user={data.session.user}
				household={{ id: data.householdId, role: data.membership.role }}
			/>

			{data.membership.role === "DICTATOR" && (
				<Card>
					<CardHeader>
						<CardTitle className="text-xl">General</CardTitle>
						<CardDescription>Update household settings and manage deletion.</CardDescription>
					</CardHeader>
					<CardContent className="space-y-8">
						<SettingsCard householdId={data.householdId} canManage={true} variant="section" />

						<DangerZone
							householdId={data.householdId}
							canDelete={data.membership.role === "DICTATOR"}
							variant="section"
						/>
					</CardContent>
				</Card>
			)}

			{data.membership.role !== "DOER" ? (
				<MembersCard
					householdId={data.householdId}
					currentUserId={data.userId}
					canManageMembers={data.membership.role === "DICTATOR"}
				/>
			) : null}

			<Card>
				<CardHeader>
					<div className="flex items-start justify-between gap-4">
						<div className="space-y-1.5">
							<CardTitle className="text-xl">Notifications</CardTitle>
							<CardDescription>Manage push notifications and task reminders for your household.</CardDescription>
						</div>
						<PushNotifications householdId={data.householdId} variant="section" />
					</div>
				</CardHeader>
			</Card>

			<InvitesCard householdId={data.householdId} canInvite={data.membership.role === "DICTATOR"} />

			<JoinCard />
		</PageShell>
	);
}
