import { cookies } from "next/headers";

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
import { getWeekViewMemberCookieName, resolveWeekViewMember } from "@/lib/week-view/memberFilter";
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

const WeekViewPage = async ({ params, searchParams }: Props) => {
	const { householdId } = await params;
	const resolvedSearchParams = searchParams ? await searchParams : {};
	const { session, userId, membership } = await getHouseholdContext(householdId);
	const t = await getServerT(session.user.language ?? DEFAULT_LANGUAGE);
	const [settings, householdMembers, cookieStore] = await Promise.all([
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
		cookies(),
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
	const selectedUserId = resolveWeekViewMember({
		query: getSingleSearchParamValue(resolvedSearchParams.userId),
		cookie: cookieStore.get(getWeekViewMemberCookieName(householdId))?.value,
		memberIds: members.map((member) => member.id),
	});
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
	const memberOptions = [
		{ id: "all", label: t("Everyone") },
		...members.map((member) => ({ id: member.id, label: member.label })),
	];

	return (
		<PageShell size="lg">
			<PageHeader
				eyebrow={t("tskr")}
				title={t("Household tasks")}
				description={t("To-do tasks and recent completions for your household.")}
				backHref={`/${householdId}`}
				backLabel={t("Back to dashboard")}
				user={session.user}
				household={{ id: householdId, role: membership.role }}
			/>

			<WeekViewTimeline
				header={
					<WeekViewRangeControls
						householdId={householdId}
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
								calendarWeek: t("This week"),
								thisWeek: t("Last 7 days"),
								thisFortnight: t("Last 14 days"),
								thisMonth: t("Last month"),
							},
						}}
					/>
				}
				entries={data.timeline}
				householdId={householdId}
				timeZone={data.timeZone}
				timeFormat={data.timeFormat}
				actingUserId={userId}
				labels={{
					emptyTitle: t("No activity in this range yet."),
					emptyDescription: t("To-do tasks and fresh completions will show up here."),
					completed: t("Completed"),
					pendingApproval: t("Pending approval"),
					planned: t("To do"),
					oneOff: t("One-off"),
				}}
			/>

			<LiveRefresh householdId={householdId} />
		</PageShell>
	);
};

export default WeekViewPage;
