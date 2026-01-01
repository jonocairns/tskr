import { getServerSession } from "next-auth";

import { ApprovalQueue } from "@/components/ApprovalQueue";
import { AssignedTaskQueue } from "@/components/AssignedTaskQueue";
import { AuditLog } from "@/components/AuditLog";
import { Leaderboard } from "@/components/Leaderboard";
import { LiveRefresh } from "@/components/LiveRefresh";
import { PageHeader } from "@/components/PageHeader";
import { PageShell } from "@/components/PageShell";
import { PointsSummary } from "@/components/PointsSummary";
import { TaskActions } from "@/components/TaskActions";
import { authOptions } from "@/lib/auth";
import { isGoogleAuthEnabled } from "@/lib/authConfig";
import { buildApprovalEntries } from "@/lib/dashboard/approvals";
import { buildAuditEntries } from "@/lib/dashboard/buildAuditEntries";
import { buildLeaderboardSummary } from "@/lib/dashboard/leaderboard";
import { mapPresetSummaries } from "@/lib/dashboard/presets";
import { getDashboardData } from "@/lib/dashboard/queries";
import { getHouseholdMembership } from "@/lib/households";

export const dynamic = "force-dynamic";

type Props = {
	params: Promise<{ householdId: string }>;
};

export default async function DashboardPage({ params }: Props) {
	const googleEnabled = isGoogleAuthEnabled;
	const session = await getServerSession(authOptions);

	// Layout handles auth check - session will always exist here
	if (!session?.user?.id) {
		throw new Error("Unauthorized");
	}

	const userId = session.user.id;
	const { householdId } = await params;

	// Get membership for role info
	const membership = await getHouseholdMembership(userId, householdId);

	if (!membership) {
		throw new Error("Membership not found");
	}

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
			<PageHeader
				eyebrow="tskr"
				title="Dashboard"
				description="Log tasks, keep an audit trail, and claim rewards when you hit the threshold."
				user={session.user}
				googleEnabled={googleEnabled}
			/>

			<PointsSummary
				points={myPoints}
				threshold={rewardThreshold}
				progressBarColor={progressBarColor}
				tasksLastWeek={weeklyTaskCount}
				pointsLastWeek={weeklyPoints}
				lastTaskAt={lastTaskAt?.toISOString() ?? null}
				currentStreak={currentStreak}
			/>

			{assignedTasks.length > 0 ? <AssignedTaskQueue entries={assignedTasks} /> : null}

			<TaskActions presets={presetSummaries} currentUserId={userId} currentUserRole={membership.role} />

			{showApprovals ? <ApprovalQueue entries={approvalEntries} currentUserId={userId} /> : null}

			<Leaderboard entries={leaderboardEntries} />

			<AuditLog entries={auditEntries} currentUserId={userId} initialHasMore={hasMoreHistory} />

			<LiveRefresh key={householdId} />
		</PageShell>
	);
}
