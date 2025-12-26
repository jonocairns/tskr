import { getServerSession } from "next-auth";

import { AuditLog } from "@/components/AuditLog";
import { AuthCta } from "@/components/AuthCta";
import { ApprovalQueue } from "@/components/ApprovalQueue";
import { Leaderboard } from "@/components/Leaderboard";
import { LiveRefresh } from "@/components/LiveRefresh";
import { ModeToggle } from "@/components/ModeToggle";
import { PointsSummary } from "@/components/PointsSummary";
import { TaskActions } from "@/components/TaskActions";
import { HouseholdSwitcher } from "@/components/HouseholdSwitcher";
import { UserMenu } from "@/components/UserMenu";
import { authOptions } from "@/lib/auth";
import { buildAuditEntries } from "@/lib/dashboard/audit-log";
import { buildApprovalEntries } from "@/lib/dashboard/approvals";
import { buildLeaderboardSummary } from "@/lib/dashboard/leaderboard";
import { mapPresetSummaries } from "@/lib/dashboard/presets";
import { getDashboardData } from "@/lib/dashboard/queries";
import { getActiveHouseholdMembership } from "@/lib/households";
import { rewardThreshold } from "@/lib/points";

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
		return (
			<main className="flex min-h-screen items-center bg-gradient-to-br from-background via-background to-muted px-4 py-12">
				<p className="text-sm text-muted-foreground">
					Unable to load your household. Please try again.
				</p>
			</main>
		);
	}
	const { householdId, membership } = active;
	const threshold = rewardThreshold();

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
		weeklyTaskCount,
		weeklyPoints,
		hasApprovalMembers,
		lastTaskAt,
		currentStreak,
	} = await getDashboardData(userId, householdId);

	const {
		entries: leaderboardEntries,
		myPoints,
		myTasks,
		myClaims,
	} = buildLeaderboardSummary({
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
				<header className="flex items-start justify-between">
					<div>
						<p className="text-xs font-semibold uppercase tracking-[0.2em] text-primary">
							tskr
						</p>
						<h1 className="text-3xl font-semibold tracking-tight">
							Task points dashboard
						</h1>
						<p className="text-sm text-muted-foreground">
							Log chores, keep an audit trail, and claim rewards when you hit
							the threshold.
						</p>
					</div>
					<div className="flex items-center gap-2">
						<ModeToggle />
						<HouseholdSwitcher />
						<UserMenu user={session.user} />
					</div>
				</header>

				<PointsSummary
					points={myPoints}
					threshold={threshold}
					tasksLogged={myTasks}
					rewardsClaimed={myClaims}
					tasksLastWeek={weeklyTaskCount}
					pointsLastWeek={weeklyPoints}
					lastTaskAt={lastTaskAt?.toISOString() ?? null}
					currentStreak={currentStreak}
				/>

				<TaskActions
					presets={presetSummaries}
					currentUserId={userId}
					currentUserRole={membership.role}
				/>

				{showApprovals ? <ApprovalQueue entries={approvalEntries} /> : null}

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
