import { DangerZone } from "@/components/household/DangerZone";
import { InvitesCard } from "@/components/household/InvitesCard";
import { JoinCard } from "@/components/household/JoinCard";
import { MembersCard } from "@/components/household/MembersCard";
import { SettingsCard } from "@/components/household/SettingsCard";
import { PageHeader } from "@/components/PageHeader";
import { PageShell } from "@/components/PageShell";
import { PushNotifications } from "@/components/PushNotifications";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/Card";
import { DEFAULT_LANGUAGE } from "@/lib/i18nConfig";
import { getServerT } from "@/lib/i18nServer";
import { getHouseholdContext } from "@/lib/serverAuth";

export const dynamic = "force-dynamic";

type Props = {
	params: Promise<{ householdId: string }>;
};

export default async function HouseholdPage({ params }: Props) {
	const { householdId } = await params;
	const { session, userId, membership } = await getHouseholdContext(householdId);
	const t = await getServerT(session.user.language ?? DEFAULT_LANGUAGE);

	return (
		<PageShell size="lg">
			<PageHeader
				eyebrow={t("tskr")}
				title={t("Household")}
				description={t("Manage settings, members, and invite codes.")}
				backHref={`/${householdId}`}
				backLabel={t("Back to dashboard")}
				user={session.user}
				household={{ id: householdId, role: membership.role }}
			/>

			{membership.role === "DICTATOR" && (
				<Card>
					<CardHeader>
						<CardTitle className="text-xl">{t("General")}</CardTitle>
						<CardDescription>{t("Update household settings and manage deletion.")}</CardDescription>
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
							<CardTitle className="text-xl">{t("Notifications")}</CardTitle>
							<CardDescription>{t("Manage push notifications and task reminders for your household.")}</CardDescription>
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
