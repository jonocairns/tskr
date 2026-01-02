import { ApprovalQueue } from "@/components/ApprovalQueue";
import { AssignedTaskQueue } from "@/components/AssignedTaskQueue";
import { AuditLog } from "@/components/AuditLog";
import { Leaderboard } from "@/components/Leaderboard";
import { LiveRefresh } from "@/components/LiveRefresh";
import { PageHeader } from "@/components/PageHeader";
import { PageShell } from "@/components/PageShell";
import { PointsSummary } from "@/components/PointsSummary";
import { TaskActions } from "@/components/TaskActions";
import { isGoogleAuthEnabled } from "@/lib/authConfig";
import { buildApprovalEntries } from "@/lib/dashboard/approvals";
import { buildAuditEntries } from "@/lib/dashboard/buildAuditEntries";
import { buildLeaderboardSummary } from "@/lib/dashboard/leaderboard";
import { mapPresetSummaries } from "@/lib/dashboard/presets";
import { getDashboardData } from "@/lib/dashboard/queries";
import { getHouseholdContext } from "@/lib/serverAuth";

export const dynamic = "force-dynamic";

type Props = {
	params: Promise<{ householdId: string }>;
};

export default async function DashboardPage({ params }: Props) {
	const googleEnabled = isGoogleAuthEnabled;
	const { householdId } = await params;
	const { session, userId, membership } = await getHouseholdContext(householdId);

	const {
		pointSums,
		earnedPointSums,
		taskCounts,
		rewardCounts,
		lastActivity,
		firstActivity,
		users,
		recentLogs,
		hasMoreHistory,
		pendingLogs,
		hasMoreApprovals,
		presets,
		assignedTasks,
		weeklyTaskCount,
		weeklyPoints,
		rewardThreshold,
		progressBarColor,
		hasApprovalMembers,
		lastTaskAt,
		currentStreak,
	} = await getDashboardData(userId, householdId);

	const { entries: leaderboardEntries, myPoints } = buildLeaderboardSummary({
		userId,
		users,
		pointSums,
		earnedPointSums,
		taskCounts,
		rewardCounts,
		lastActivity,
		firstActivity,
	});
	const presetSummaries = mapPresetSummaries(presets);
	const auditEntries = buildAuditEntries(recentLogs);
	const approvalEntries = buildApprovalEntries(pendingLogs);
	const showApprovals = membership.role !== "DOER" && (hasApprovalMembers || approvalEntries.length > 0);

	return (
		<PageShell>
			<PageHeader
				eyebrow="tskr"
				title="Dashboard"
				description="Log tasks, keep an audit trail, and claim rewards when you hit the threshold."
				user={session.user}
				googleEnabled={googleEnabled}
				household={{ id: householdId, role: membership.role }}
			/>

			<PointsSummary
				points={myPoints}
				threshold={rewardThreshold}
				progressBarColor={progressBarColor}
				tasksLastWeek={weeklyTaskCount}
				pointsLastWeek={weeklyPoints}
				lastTaskAt={lastTaskAt?.toISOString() ?? null}
				currentStreak={currentStreak}
				householdId={householdId}
			/>

			{assignedTasks.length > 0 ? <AssignedTaskQueue entries={assignedTasks} householdId={householdId} /> : null}

			<TaskActions
				householdId={householdId}
				presets={presetSummaries}
				currentUserId={userId}
				currentUserRole={membership.role}
			/>

			{showApprovals ? (
				<ApprovalQueue entries={approvalEntries} currentUserId={userId} initialHasMore={hasMoreApprovals} />
			) : null}

			<Leaderboard entries={leaderboardEntries} />

			<AuditLog
				entries={auditEntries}
				currentUserId={userId}
				initialHasMore={hasMoreHistory}
				householdId={householdId}
			/>

			<LiveRefresh householdId={householdId} />
		</PageShell>
	);
}
