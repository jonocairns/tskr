import { LiveRefresh } from "@/components/LiveRefresh";
import { PageHeader } from "@/components/PageHeader";
import { PageShell } from "@/components/PageShell";
import { WeekViewRangeControls } from "@/components/WeekViewRangeControls";
import { WeekViewSummary } from "@/components/WeekViewSummary";
import { WeekViewTimeline } from "@/components/WeekViewTimeline";
import { DEFAULT_LANGUAGE } from "@/lib/i18nConfig";
import { getServerT } from "@/lib/i18nServer";
import { prisma } from "@/lib/prisma";
import { getHouseholdContext } from "@/lib/serverAuth";
import { parseWeekViewRange } from "@/lib/week-view/buildTimeline";
import { getWeekViewData, getWeekViewHouseholdSettings } from "@/lib/week-view/queries";

export const dynamic = "force-dynamic";

type SearchParams = {
	from?: string | string[];
	to?: string | string[];
	userId?: string | string[];
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
	const [settings, householdMembers] = await Promise.all([
		getWeekViewHouseholdSettings(householdId),
		prisma.householdMember.findMany({
			where: { householdId },
			select: {
				userId: true,
				user: {
					select: {
						name: true,
						email: true,
					},
				},
			},
		}),
	]);
	const getMemberLabel = (member: { user: { name: string | null; email: string | null } }) =>
		member.user.name ?? member.user.email ?? t("Unknown");
	const members = householdMembers
		.map((member) => ({
			id: member.userId,
			label: member.userId === userId ? `${getMemberLabel(member)} (${t("You")})` : getMemberLabel(member),
			name: getMemberLabel(member),
		}))
		.sort((left, right) => left.name.localeCompare(right.name, undefined, { sensitivity: "base" }));
	const selectedUserIdFromSearch = getSingleSearchParamValue(resolvedSearchParams.userId);
	const selectedMember =
		members.find((member) => member.id === selectedUserIdFromSearch) ?? members.find((member) => member.id === userId);
	const selectedUserId = selectedMember?.id ?? userId;
	const viewingSelf = selectedUserId === userId;
	const range = parseWeekViewRange({
		from: getSingleSearchParamValue(resolvedSearchParams.from),
		to: getSingleSearchParamValue(resolvedSearchParams.to),
		timeZone: settings.timeZone,
	});
	const data = await getWeekViewData({
		householdId,
		userId: selectedUserId,
		range,
		...settings,
	});
	const rangeTitle = data.range.labelKey === "past7Days" ? t("Past 7 days") : t("Custom range");
	const summaryTitle = viewingSelf || !selectedMember ? rangeTitle : `${rangeTitle} · ${selectedMember.name}`;
	const pageDescription = viewingSelf
		? t("Recent completions and planned tasks in one simple timeline.")
		: t("Recent completions and planned tasks for the selected household member.");
	const timelineDescription = viewingSelf
		? t("Completed activity and planned task windows together.")
		: t("Completed activity and planned task windows for the selected household member.");
	const emptyDescription = viewingSelf
		? t("When something gets logged or assigned here, it will show up in this timeline.")
		: t("When something gets logged or assigned for this member in this range, it will show up here.");

	return (
		<PageShell size="lg">
			<PageHeader
				eyebrow={t("tskr")}
				title={t("Week view")}
				description={pageDescription}
				backHref={`/${householdId}`}
				backLabel={t("Back to dashboard")}
				user={session.user}
				household={{ id: householdId, role: membership.role }}
			/>

			<WeekViewRangeControls
				householdId={householdId}
				actingUserId={userId}
				selectedUserId={selectedUserId}
				members={members}
				range={data.range}
				timeZone={data.timeZone}
				labels={{
					title: t("View options"),
					description: t("Pick a household member and household-local dates to update the timeline by URL."),
					member: t("Member"),
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
				title={summaryTitle}
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
				canCompletePlannedEntries={viewingSelf}
				labels={{
					title: t("Timeline"),
					description: timelineDescription,
					emptyTitle: t("No activity in this range yet."),
					emptyDescription: emptyDescription,
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
