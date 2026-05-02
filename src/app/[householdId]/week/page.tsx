import { LiveRefresh } from "@/components/LiveRefresh";
import { PageHeader } from "@/components/PageHeader";
import { PageShell } from "@/components/PageShell";
import { WeekViewSummary } from "@/components/WeekViewSummary";
import { WeekViewTimeline } from "@/components/WeekViewTimeline";
import { DEFAULT_LANGUAGE } from "@/lib/i18nConfig";
import { getServerT } from "@/lib/i18nServer";
import { getHouseholdContext } from "@/lib/serverAuth";
import { getWeekViewData } from "@/lib/week-view/queries";

export const dynamic = "force-dynamic";

type Props = {
	params: Promise<{ householdId: string }>;
};

export default async function WeekViewPage({ params }: Props) {
	const { householdId } = await params;
	const { session, userId, membership } = await getHouseholdContext(householdId);
	const t = await getServerT(session.user.language ?? DEFAULT_LANGUAGE);
	const data = await getWeekViewData({ householdId, userId });

	return (
		<PageShell size="lg">
			<PageHeader
				eyebrow={t("tskr")}
				title={t("Week view")}
				description={t("Recent completions and planned tasks in one simple timeline.")}
				backHref={`/${householdId}`}
				backLabel={t("Back to dashboard")}
				user={session.user}
				household={{ id: householdId, role: membership.role }}
			/>

			<WeekViewSummary
				range={data.range}
				timeZone={data.timeZone}
				dateFormat={data.dateFormat}
				completedCount={data.completedCount}
				pendingCount={data.pendingCount}
				approvedPoints={data.approvedPoints}
				plannedCount={data.plannedCount}
				title={t(data.range.label)}
				labels={{
					completed: t("Completed"),
					pendingApproval: t("Pending approval"),
					approvedPoints: t("Approved points"),
					planned: t("Planned"),
				}}
			/>

			<WeekViewTimeline
				entries={data.timeline}
				timeZone={data.timeZone}
				dateFormat={data.dateFormat}
				timeFormat={data.timeFormat}
				labels={{
					title: t("Timeline"),
					description: t("Completed activity and planned task windows together."),
					emptyTitle: t("No activity in this range yet."),
					emptyDescription: t("When something gets logged or assigned here, it will show up in this timeline."),
					completed: t("Completed"),
					pendingApproval: t("Pending approval"),
					planned: t("Planned"),
					oneOff: t("One-off"),
				}}
			/>

			<LiveRefresh householdId={householdId} />
		</PageShell>
	);
}
