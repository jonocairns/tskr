import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";

import { ApprovalQueue } from "@/components/ApprovalQueue";
import { AssignedTaskQueue } from "@/components/AssignedTaskQueue";
import { AuditLog } from "@/components/AuditLog";
import { AuthCta } from "@/components/AuthCta";
import { Leaderboard } from "@/components/Leaderboard";
import { LiveRefresh } from "@/components/LiveRefresh";
import { PageHeader } from "@/components/PageHeader";
import { PointsSummary } from "@/components/PointsSummary";
import { TaskActions } from "@/components/TaskActions";
import { authOptions } from "@/lib/auth";
import { buildApprovalEntries } from "@/lib/dashboard/approvals";
import { buildAuditEntries } from "@/lib/dashboard/audit-log";
import { buildLeaderboardSummary } from "@/lib/dashboard/leaderboard";
import { mapPresetSummaries } from "@/lib/dashboard/presets";
import { getDashboardData } from "@/lib/dashboard/queries";
import { getActiveHouseholdMembership } from "@/lib/households";

export const dynamic = "force-dynamic";

export default async function Home() {
	const session = await getServerSession(authOptions);

	if (!session?.user?.id) {
		return (
			<main className="flex min-h-screen items-center bg-gradient-to-br from-background via-background to-muted px-4 py-12">
				<AuthCta />
			</main>
		);
	}

	const userId = session.user.id;
	const active = await getActiveHouseholdMembership(
		userId,
		session.user.householdId ?? null,
	);
	if (!active) {
		redirect("/landing");
	}
	const { householdId, membership } = active;

	const {
		pointSums,
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
		hasApprovalMembers,
		lastTaskAt,
		currentStreak,
	} = await getDashboardData(userId, householdId);

	const { entries: leaderboardEntries, myPoints } = buildLeaderboardSummary({
		userId,
		users,
		pointSums,
		taskCounts,
		rewardCounts,
		lastActivity,
	});
	const presetSummaries = mapPresetSummaries(presets);
	const auditEntries = buildAuditEntries(recentLogs);
	const approvalEntries = buildApprovalEntries(pendingLogs);
	const showApprovals =
		membership.role !== "DOER" &&
		(hasApprovalMembers || approvalEntries.length > 0);

	return (
		<main className="min-h-screen bg-gradient-to-br from-background via-background to-muted">
			<div className="mx-auto flex max-w-6xl flex-col gap-6 px-4 py-10">
				<PageHeader
					eyebrow="tskr"
					title="Task points dashboard"
					description="Log tasks, keep an audit trail, and claim rewards when you hit the threshold."
					user={session.user}
				/>

				<PointsSummary
					points={myPoints}
					threshold={rewardThreshold}
					tasksLastWeek={weeklyTaskCount}
					pointsLastWeek={weeklyPoints}
					lastTaskAt={lastTaskAt?.toISOString() ?? null}
					currentStreak={currentStreak}
				/>

				{assignedTasks.length > 0 ? (
					<AssignedTaskQueue entries={assignedTasks} />
				) : null}

				<TaskActions
					presets={presetSummaries}
					currentUserId={userId}
					currentUserRole={membership.role}
				/>

				{showApprovals ? (
					<ApprovalQueue entries={approvalEntries} currentUserId={userId} />
				) : null}

				<Leaderboard entries={leaderboardEntries} />

				<AuditLog
					entries={auditEntries}
					currentUserId={userId}
					initialHasMore={hasMoreHistory}
				/>

				<LiveRefresh key={householdId} />
			</div>
		</main>
	);
}
