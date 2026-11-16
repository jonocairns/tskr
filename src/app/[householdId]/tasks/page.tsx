import { cookies } from "next/headers";
import Link from "next/link";

import { AssignedTasksManager } from "@/components/AssignedTasksManager";
import { AssignedTaskTable } from "@/components/AssignedTaskTable";
import { AssignTaskCard } from "@/components/AssignTaskCard";
import { LiveRefresh } from "@/components/LiveRefresh";
import { PageHeader } from "@/components/PageHeader";
import { PageShell } from "@/components/PageShell";
import { Card, CardContent, CardHeader } from "@/components/ui/Card";
import { WeekViewRangeControls } from "@/components/WeekViewRangeControls";
import { WeekViewTimeline } from "@/components/WeekViewTimeline";
import { DEFAULT_LANGUAGE } from "@/lib/i18nConfig";
import { getServerT } from "@/lib/i18nServer";
import { prisma } from "@/lib/prisma";
import { getHouseholdContext } from "@/lib/serverAuth";
import { buildTasksHref, getSingleSearchParamValue, resolveTasksTab, type TasksSearchParams } from "@/lib/tasks/href";
import { getTasksManageData, getTasksTodoData } from "@/lib/tasks/queries";
import { cn } from "@/lib/utils";
import { parseWeekViewRange } from "@/lib/week-view/buildTimeline";
import { getWeekViewMemberCookieName, resolveWeekViewMember } from "@/lib/week-view/memberFilter";
import { getWeekViewData, getWeekViewHouseholdSettings } from "@/lib/week-view/queries";

export const dynamic = "force-dynamic";

type Props = {
	params: Promise<{ householdId: string }>;
	searchParams?: Promise<TasksSearchParams>;
};

const TasksPage = async ({ params, searchParams }: Props) => {
	const { householdId } = await params;
	const resolvedSearchParams = searchParams ? await searchParams : {};
	const { session, userId, membership } = await getHouseholdContext(householdId);
	const tab = resolveTasksTab(resolvedSearchParams, membership.role);
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
	const rangeParams = {
		from: getSingleSearchParamValue(resolvedSearchParams.from),
		to: getSingleSearchParamValue(resolvedSearchParams.to),
		preset: getSingleSearchParamValue(resolvedSearchParams.preset),
	};
	const range = parseWeekViewRange({ ...(tab === "manage" ? {} : rangeParams), timeZone: settings.timeZone });
	const doneData =
		tab === "done" ? await getWeekViewData({ householdId, userId: selectedUserId, range, ...settings }) : null;
	const todoEntries =
		tab === "todo"
			? await getTasksTodoData({
					householdId,
					actingUserId: userId,
					userId: selectedUserId,
					timeZone: settings.timeZone,
				})
			: [];
	const manageData =
		tab === "manage" ? await getTasksManageData({ householdId, userId, timeZone: settings.timeZone }) : null;
	const memberOptions = [
		{ id: "all", label: t("Everyone") },
		...members.map((member) => ({ id: member.id, label: member.label })),
	];

	const controls =
		tab !== "manage" ? (
			<WeekViewRangeControls
				tab={tab}
				rangeParams={rangeParams}
				householdId={householdId}
				selectedUserId={selectedUserId}
				members={memberOptions}
				range={range}
				timeZone={settings.timeZone}
				dateFormat={settings.dateFormat}
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
		) : null;

	return (
		<PageShell size="lg">
			<PageHeader
				eyebrow={t("tskr")}
				title={t("Tasks")}
				description={t("To-do tasks and recent completions for your household.")}
				backHref={`/${householdId}`}
				backLabel={t("Back to dashboard")}
				backText={t("Dashboard")}
				user={session.user}
				household={{ id: householdId, role: membership.role }}
			/>
			<nav aria-label={t("Tasks")} className="flex gap-2">
				{(
					[
						{ id: "todo", label: t("To do") },
						{ id: "done", label: t("Done") },
						...(membership.role !== "DOER" ? [{ id: "manage", label: t("Manage") } as const] : []),
					] as const
				).map((item) => (
					<Link
						key={item.id}
						href={buildTasksHref(householdId, { tab: item.id, userId: selectedUserId, ...rangeParams })}
						aria-current={tab === item.id ? "page" : undefined}
						className={cn(
							"rounded-md px-4 py-2 text-sm font-medium",
							tab === item.id ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:bg-accent",
						)}
					>
						{item.label}
					</Link>
				))}
			</nav>
			{manageData ? (
				<>
					<AssignTaskCard
						householdId={householdId}
						members={manageData.members}
						presets={manageData.presets}
						existingTasks={manageData.tasks}
						currentUserId={userId}
					/>
					<AssignedTasksManager
						householdId={householdId}
						initialTasks={manageData.tasks}
						members={manageData.members}
					/>
				</>
			) : doneData ? (
				<WeekViewTimeline
					header={controls}
					entries={doneData.timeline}
					timeZone={settings.timeZone}
					timeFormat={settings.timeFormat}
					labels={{
						emptyTitle: t("No completions in this range yet."),
						emptyDescription: t("Completed tasks will show up here."),
						completed: t("Completed"),
						pendingApproval: t("Pending approval"),
						quickLog: t("Quick log"),
					}}
				/>
			) : (
				<Card>
					<CardHeader>{controls}</CardHeader>
					<CardContent>
						<AssignedTaskTable
							householdId={householdId}
							entries={todoEntries}
							mineLabel={
								selectedUserId !== "all" && selectedUserId !== userId
									? members.find((member) => member.id === selectedUserId)?.name
									: undefined
							}
							collapseOthers={selectedUserId === "all"}
							{...settings}
						/>
					</CardContent>
				</Card>
			)}
			<LiveRefresh householdId={householdId} enabled={tab !== "manage"} />
		</PageShell>
	);
};

export default TasksPage;
