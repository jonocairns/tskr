import { createFileRoute, redirect } from "@tanstack/react-router";
import { createServerFn } from "@tanstack/react-start";
import { getRequestHeaders } from "@tanstack/react-start/server";
import { auth } from "@/auth/auth";
import { ApprovalQueue } from "@/components/ApprovalQueue";
import { AssignedTaskQueue } from "@/components/AssignedTaskQueue";
import { AuditLog } from "@/components/AuditLog";
import { Leaderboard } from "@/components/Leaderboard";
import { LiveRefresh } from "@/components/LiveRefresh";
import { PageHeader } from "@/components/PageHeader";
import { PageShell } from "@/components/PageShell";
import { PointsSummary } from "@/components/PointsSummary";
import { TaskActions } from "@/components/TaskActions";
import { buildApprovalEntries } from "@/lib/dashboard/approvals";
import { buildAuditEntries } from "@/lib/dashboard/buildAuditEntries";
import { buildLeaderboardSummary } from "@/lib/dashboard/leaderboard";
import { mapPresetSummaries } from "@/lib/dashboard/presets";
import { getDashboardData } from "@/lib/dashboard/queries";
import { getActiveHouseholdMembership, getHouseholdMembership } from "@/lib/households";

import type { HouseholdContext } from "../_layout";

const loadDashboard = createServerFn({ method: "GET" })
	.inputValidator((data: { householdId: string }) => data)
	.handler(async ({ data: { householdId } }) => {
		const headers = getRequestHeaders();
		const session = await auth.api.getSession({ headers });

		if (!session?.user?.id) {
			throw redirect({ to: "/", search: { error: undefined } });
		}

		const membership = await getHouseholdMembership(session.user.id, householdId);
		if (!membership) {
			const active = await getActiveHouseholdMembership(session.user.id);
			if (active) {
				throw redirect({
					to: "/$householdId",
					params: { householdId: active.householdId },
					search: { error: "HouseholdAccessDenied" },
				});
			}
			throw redirect({ to: "/landing", search: { error: "NoHouseholdMembership" } });
		}

		const userId = session.user.id;
		const dashboardData = await getDashboardData(userId, householdId);

		const { entries: leaderboardEntries, myPoints } = buildLeaderboardSummary({
			userId,
			users: dashboardData.users,
			pointSums: dashboardData.pointSums,
			earnedPointSums: dashboardData.earnedPointSums,
			taskCounts: dashboardData.taskCounts,
			rewardCounts: dashboardData.rewardCounts,
			lastActivity: dashboardData.lastActivity,
			firstActivity: dashboardData.firstActivity,
		});

		const presetSummaries = mapPresetSummaries(dashboardData.presets);
		const auditEntries = buildAuditEntries(dashboardData.recentLogs);
		const approvalEntries = buildApprovalEntries(dashboardData.pendingLogs);
		const showApprovals =
			membership.role !== "DOER" && (dashboardData.hasApprovalMembers || approvalEntries.length > 0);

		return {
			myPoints,
			leaderboardEntries,
			presetSummaries,
			auditEntries,
			approvalEntries,
			showApprovals,
			rewardThreshold: dashboardData.rewardThreshold,
			progressBarColor: dashboardData.progressBarColor,
			weeklyTaskCount: dashboardData.weeklyTaskCount,
			weeklyPoints: dashboardData.weeklyPoints,
			lastTaskAt: dashboardData.lastTaskAt?.toISOString() ?? null,
			currentStreak: dashboardData.currentStreak,
			assignedTasks: dashboardData.assignedTasks,
			hasMoreHistory: dashboardData.hasMoreHistory,
			hasMoreApprovals: dashboardData.hasMoreApprovals,
		};
	});

export const Route = createFileRoute("/$householdId/_layout/")({
	loader: async ({ params, context }) => {
		const { householdContext } = context as { householdContext: HouseholdContext };
		const data = await loadDashboard({
			data: {
				householdId: params.householdId,
			},
		});
		return { ...data, householdContext };
	},
	component: DashboardPage,
});

function DashboardPage() {
	const data = Route.useLoaderData();
	const { householdContext } = data;

	return (
		<PageShell>
			<PageHeader
				eyebrow="tskr"
				title="Dashboard"
				description="Log tasks, keep an audit trail, and claim rewards when you hit the threshold."
				user={householdContext.session.user}
				household={{ id: householdContext.householdId, role: householdContext.membership.role }}
			/>

			<PointsSummary
				points={data.myPoints}
				threshold={data.rewardThreshold}
				progressBarColor={data.progressBarColor}
				tasksLastWeek={data.weeklyTaskCount}
				pointsLastWeek={data.weeklyPoints}
				lastTaskAt={data.lastTaskAt}
				currentStreak={data.currentStreak}
				householdId={householdContext.householdId}
			/>

			{data.assignedTasks.length > 0 ? (
				<AssignedTaskQueue entries={data.assignedTasks} householdId={householdContext.householdId} />
			) : null}

			<TaskActions
				householdId={householdContext.householdId}
				presets={data.presetSummaries}
				currentUserId={householdContext.userId}
				currentUserRole={householdContext.membership.role}
			/>

			{data.showApprovals ? (
				<ApprovalQueue
					entries={data.approvalEntries}
					currentUserId={householdContext.userId}
					initialHasMore={data.hasMoreApprovals}
				/>
			) : null}

			<Leaderboard entries={data.leaderboardEntries} />

			<AuditLog
				entries={data.auditEntries}
				currentUserId={householdContext.userId}
				initialHasMore={data.hasMoreHistory}
				householdId={householdContext.householdId}
			/>

			<LiveRefresh householdId={householdContext.householdId} />
		</PageShell>
	);
}
