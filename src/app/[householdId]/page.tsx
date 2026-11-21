import { ApprovalQueue } from "@/components/ApprovalQueue";
import { AssignedTaskQueue } from "@/components/AssignedTaskQueue";
import { AuditLog } from "@/components/AuditLog";
import { Leaderboard } from "@/components/Leaderboard";
import { LiveRefresh } from "@/components/LiveRefresh";
import { PageHeader } from "@/components/PageHeader";
import { PageShell } from "@/components/PageShell";
import { PointsSummary } from "@/components/PointsSummary";
import { RewardProgressBadge } from "@/components/RewardProgressBadge";
import { TaskActions } from "@/components/TaskActions";
import { buildApprovalEntries } from "@/lib/dashboard/approvals";
import { buildAuditEntries } from "@/lib/dashboard/buildAuditEntries";
import { buildLeaderboardSummary } from "@/lib/dashboard/leaderboard";
import { mapPresetSummaries } from "@/lib/dashboard/presets";
import { getDashboardData } from "@/lib/dashboard/queries";
import { shouldShowTaskBoard } from "@/lib/dashboard/taskBoard";
import { DEFAULT_LANGUAGE } from "@/lib/i18nConfig";
import { getServerT } from "@/lib/i18nServer";
import { getHouseholdContext } from "@/lib/serverAuth";

export const dynamic = "force-dynamic";

type Props = {
	params: Promise<{ householdId: string }>;
};

export default async function DashboardPage({ params }: Props) {
	const { householdId } = await params;
	const { session, userId, membership } = await getHouseholdContext(householdId);
	const t = await getServerT(session.user.language ?? DEFAULT_LANGUAGE);

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
		hasActiveAssignedTasks,
		householdDoneThisWeek,
		weeklyTaskCount,
		weeklyPoints,
		rewardThreshold,
		rewardClaimAllowance,
		progressBarColor,
		timeZone,
		dateFormat,
		timeFormat,
		hasApprovalMembers,
		lastTaskAt,
		hasPendingTasks,
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
				eyebrow={t("tskr")}
				title={t("Dashboard")}
				description={t("Log tasks, keep an audit trail, and claim rewards when you hit the threshold.")}
				user={session.user}
				household={{ id: householdId, role: membership.role }}
			/>

			<PointsSummary
				points={myPoints}
				threshold={rewardThreshold}
				rewardClaimAllowance={rewardClaimAllowance}
				progressBarColor={progressBarColor}
				tasksLastWeek={weeklyTaskCount}
				pointsLastWeek={weeklyPoints}
				lastTaskAt={lastTaskAt?.toISOString() ?? null}
				currentStreak={currentStreak}
				hasPendingTasks={hasPendingTasks}
				timeZone={timeZone}
				dateFormat={dateFormat}
				timeFormat={timeFormat}
				householdId={householdId}
			/>

			{shouldShowTaskBoard(membership.role, hasActiveAssignedTasks, householdDoneThisWeek) ? (
				<AssignedTaskQueue
					entries={assignedTasks}
					doneThisWeek={householdDoneThisWeek}
					householdId={householdId}
					canManageTasks={membership.role !== "DOER"}
					timeZone={timeZone}
					dateFormat={dateFormat}
					timeFormat={timeFormat}
				/>
			) : null}

			<TaskActions
				householdId={householdId}
				presets={presetSummaries}
				currentUserId={userId}
				currentUserRole={membership.role}
				headerAction={
					<RewardProgressBadge
						householdId={householdId}
						points={myPoints}
						threshold={rewardThreshold}
						claimsRemaining={rewardClaimAllowance?.remaining ?? null}
						progressBarColor={progressBarColor}
						compact
					/>
				}
			/>

			{showApprovals ? (
				<ApprovalQueue
					entries={approvalEntries}
					currentUserId={userId}
					initialHasMore={hasMoreApprovals}
					timeZone={timeZone}
					dateFormat={dateFormat}
					timeFormat={timeFormat}
				/>
			) : null}

			<Leaderboard entries={leaderboardEntries} timeZone={timeZone} dateFormat={dateFormat} />

			<AuditLog
				entries={auditEntries}
				currentUserId={userId}
				initialHasMore={hasMoreHistory}
				householdId={householdId}
				timeZone={timeZone}
				dateFormat={dateFormat}
				timeFormat={timeFormat}
			/>

			<LiveRefresh householdId={householdId} />
		</PageShell>
	);
}
