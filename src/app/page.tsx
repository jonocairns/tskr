import { getServerSession } from "next-auth";

import { AuditLog } from "@/components/audit-log";
import { AuthCta } from "@/components/auth-cta";
import { Leaderboard } from "@/components/leaderboard";
import { LiveRefresh } from "@/components/live-refresh";
import { ModeToggle } from "@/components/mode-toggle";
import { PointsSummary } from "@/components/points-summary";
import { PushNotifications } from "@/components/push-notifications";
import { TaskActions } from "@/components/task-actions";
import { UserMenu } from "@/components/user-menu";
import { authOptions } from "@/lib/auth";
import { buildAuditEntries } from "@/lib/dashboard/audit-log";
import { buildLeaderboardSummary } from "@/lib/dashboard/leaderboard";
import { mapPresetSummaries } from "@/lib/dashboard/presets";
import { getDashboardData } from "@/lib/dashboard/queries";
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
	const threshold = rewardThreshold();

	const {
		pointSums,
		taskCounts,
		rewardCounts,
		lastActivity,
		users,
		recentLogs,
		presets,
	} = await getDashboardData(userId);

	const { entries: leaderboardEntries, myPoints, myTasks, myClaims } =
		buildLeaderboardSummary({
			userId,
			users,
			pointSums,
			taskCounts,
			rewardCounts,
			lastActivity,
		});
	const presetSummaries = mapPresetSummaries(presets);
	const auditEntries = buildAuditEntries(recentLogs);

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
						<UserMenu user={session.user} />
					</div>
				</header>

				<PointsSummary
					points={myPoints}
					threshold={threshold}
					tasksLogged={myTasks}
					rewardsClaimed={myClaims}
				/>

				<TaskActions presets={presetSummaries} currentUserId={userId} />

				<AuditLog entries={auditEntries} />

				<Leaderboard entries={leaderboardEntries} />

				<PushNotifications />

				<LiveRefresh />
			</div>
		</main>
	);
}
