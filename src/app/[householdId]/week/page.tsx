import { LiveRefresh } from "@/components/LiveRefresh";
import { PageHeader } from "@/components/PageHeader";
import { PageShell } from "@/components/PageShell";
import { WeekViewRangeControls } from "@/components/WeekViewRangeControls";
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
	preset?: string | string[];
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
		preset: getSingleSearchParamValue(resolvedSearchParams.preset),
		timeZone: settings.timeZone,
	});
	const data = await getWeekViewData({
		householdId,
		userId: selectedUserId,
		range,
		...settings,
	});
	const memberOptions = members.map((member) => ({
		id: member.id,
		label: member.id === userId && viewingSelf ? `${member.name} (${t("You")})` : member.label,
	}));

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

			<WeekViewTimeline
				header={
					<WeekViewRangeControls
						householdId={householdId}
						actingUserId={userId}
						selectedUserId={selectedUserId}
						members={memberOptions}
						range={data.range}
						timeZone={data.timeZone}
						dateFormat={data.dateFormat}
						labels={{
							member: t("Member"),
							dateRange: t("Date range"),
							from: t("From"),
							to: t("To"),
							apply: t("Apply"),
							presets: {
								thisWeek: t("Week"),
								thisFortnight: t("Fortnight"),
								thisMonth: t("Month"),
							},
						}}
					/>
				}
				entries={data.timeline}
				householdId={householdId}
				timeZone={data.timeZone}
				timeFormat={data.timeFormat}
				canCompletePlannedEntries={viewingSelf}
				labels={{
					emptyTitle: t("No activity in this range yet."),
					emptyDescription: t("Upcoming assigned tasks and fresh completions will show up here."),
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
