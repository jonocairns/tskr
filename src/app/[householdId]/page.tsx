import { ApprovalQueue } from "@/components/ApprovalQueue";
import { AssignedTaskQueue } from "@/components/AssignedTaskQueue";
import { AuditLog } from "@/components/AuditLog";
import { HouseholdErrorToast } from "@/components/HouseholdErrorToast";
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
	const ctx = await getHouseholdContext(householdId);

	if (!ctx) {
		throw new Error("Unauthorized or membership not found");
	}

	const { session, userId, membership } = ctx;

	const {
		pointSums,
		earnedPointSums,
		taskCounts,
		rewardCounts,
		lastActivity,
		users,
		recentLogs,
		hasMoreHistory,
		pendingLogs,
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
	});
	const presetSummaries = mapPresetSummaries(presets);
	const auditEntries = buildAuditEntries(recentLogs);
	const approvalEntries = buildApprovalEntries(pendingLogs);
	const showApprovals = membership.role !== "DOER" && (hasApprovalMembers || approvalEntries.length > 0);

	return (
		<PageShell>
			<HouseholdErrorToast />

			<PageHeader
				eyebrow="tskr"
				title="Dashboard"
				description="Log tasks, keep an audit trail, and claim rewards when you hit the threshold."
				householdId={householdId}
				user={session.user}
				googleEnabled={googleEnabled}
				household={{ id: householdId, role: membership.role }}
			/>

			<PointsSummary
				householdId={householdId}
				points={myPoints}
				threshold={rewardThreshold}
				progressBarColor={progressBarColor}
				tasksLastWeek={weeklyTaskCount}
				pointsLastWeek={weeklyPoints}
				lastTaskAt={lastTaskAt?.toISOString() ?? null}
				currentStreak={currentStreak}
			/>

			{assignedTasks.length > 0 ? <AssignedTaskQueue householdId={householdId} entries={assignedTasks} /> : null}

			<TaskActions
				householdId={householdId}
				presets={presetSummaries}
				currentUserId={userId}
				currentUserRole={membership.role}
			/>

			{showApprovals ? <ApprovalQueue householdId={householdId} entries={approvalEntries} currentUserId={userId} /> : null}

			<Leaderboard entries={leaderboardEntries} />

			<AuditLog householdId={householdId} entries={auditEntries} currentUserId={userId} initialHasMore={hasMoreHistory} />

			<LiveRefresh householdId={householdId} />
		</PageShell>
	);
}
