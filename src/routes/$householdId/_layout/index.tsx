import { createFileRoute } from "@tanstack/react-router";
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
import { getHouseholdMembership } from "@/lib/households";

const loadDashboard = createServerFn({ method: "GET" })
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
			session: {
				user: {
					id: session.user.id,
					name: session.user.name,
					email: session.user.email,
					image: session.user.image,
					isSuperAdmin: (session.user as { isSuperAdmin?: boolean }).isSuperAdmin ?? false,
				},
			},
			userId,
			householdId,
			membership,
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
	loader: ({ params }) => loadDashboard({ data: { householdId: params.householdId } }),
	component: DashboardPage,
});

function DashboardPage() {
	const data = Route.useLoaderData();

	return (
		<PageShell>
			<PageHeader
				eyebrow="tskr"
				title="Dashboard"
				description="Log tasks, keep an audit trail, and claim rewards when you hit the threshold."
				user={data.session.user}
				household={{ id: data.householdId, role: data.membership.role }}
			/>

			<PointsSummary
				points={data.myPoints}
				threshold={data.rewardThreshold}
				progressBarColor={data.progressBarColor}
				tasksLastWeek={data.weeklyTaskCount}
				pointsLastWeek={data.weeklyPoints}
				lastTaskAt={data.lastTaskAt}
				currentStreak={data.currentStreak}
				householdId={data.householdId}
			/>

			{data.assignedTasks.length > 0 ? (
				<AssignedTaskQueue entries={data.assignedTasks} householdId={data.householdId} />
			) : null}

			<TaskActions
				householdId={data.householdId}
				presets={data.presetSummaries}
				currentUserId={data.userId}
				currentUserRole={data.membership.role}
			/>

			{data.showApprovals ? (
				<ApprovalQueue
					entries={data.approvalEntries}
					currentUserId={data.userId}
					initialHasMore={data.hasMoreApprovals}
				/>
			) : null}

			<Leaderboard entries={data.leaderboardEntries} />

			<AuditLog
				entries={data.auditEntries}
				currentUserId={data.userId}
				initialHasMore={data.hasMoreHistory}
				householdId={data.householdId}
			/>

			<LiveRefresh householdId={data.householdId} />
		</PageShell>
	);
}
