import { LiveRefresh } from "@/components/LiveRefresh";
import { PageHeader } from "@/components/PageHeader";
import { PageShell } from "@/components/PageShell";
import { WeekViewRangeControls } from "@/components/WeekViewRangeControls";
import { WeekViewSummary } from "@/components/WeekViewSummary";
import { WeekViewTimeline } from "@/components/WeekViewTimeline";
import { DEFAULT_LANGUAGE } from "@/lib/i18nConfig";
import { getServerT } from "@/lib/i18nServer";
import { getHouseholdContext } from "@/lib/serverAuth";
import { parseWeekViewRange } from "@/lib/week-view/buildTimeline";
import { getWeekViewData, getWeekViewHouseholdSettings } from "@/lib/week-view/queries";

export const dynamic = "force-dynamic";

type SearchParams = {
	from?: string | string[];
	to?: string | string[];
};

type Props = {
	params: Promise<{ householdId: string }>;
	searchParams?: Promise<SearchParams>;
};

const getSingleSearchParamValue = (value?: string | string[]) => {
	if (Array.isArray(value)) {
		return value[0] ?? null;
	}
	return value ?? null;
};

export default async function WeekViewPage({ params, searchParams }: Props) {
	const { householdId } = await params;
	const resolvedSearchParams = searchParams ? await searchParams : {};
	const { session, userId, membership } = await getHouseholdContext(householdId);
	const t = await getServerT(session.user.language ?? DEFAULT_LANGUAGE);
	const settings = await getWeekViewHouseholdSettings(householdId);
	const range = parseWeekViewRange({
		from: getSingleSearchParamValue(resolvedSearchParams.from),
		to: getSingleSearchParamValue(resolvedSearchParams.to),
		timeZone: settings.timeZone,
	});
	const data = await getWeekViewData({
		householdId,
		userId,
		range,
		...settings,
	});
	const rangeTitle = data.range.labelKey === "past7Days" ? t("Past 7 days") : t("Custom range");

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

			<WeekViewRangeControls
				householdId={householdId}
				range={data.range}
				timeZone={data.timeZone}
				labels={{
					title: t("Date range"),
					description: t("Pick household-local dates and update the timeline by URL."),
					from: t("From"),
					to: t("To"),
					apply: t("Apply range"),
					reset: t("Reset to Past 7 days"),
				}}
			/>

			<WeekViewSummary
				range={data.range}
				timeZone={data.timeZone}
				dateFormat={data.dateFormat}
				completedCount={data.completedCount}
				pendingCount={data.pendingCount}
				approvedPoints={data.approvedPoints}
				plannedCount={data.plannedCount}
				title={rangeTitle}
				labels={{
					completed: t("Completed"),
					pendingApproval: t("Pending approval"),
					approvedPoints: t("Approved points"),
					planned: t("Planned"),
				}}
			/>

			<WeekViewTimeline
				entries={data.timeline}
				householdId={householdId}
				timeZone={data.timeZone}
				dateFormat={data.dateFormat}
				timeFormat={data.timeFormat}
				canCompletePlannedEntries
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
