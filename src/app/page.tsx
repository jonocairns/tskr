import { getServerSession } from "next-auth";

import { AuditLog } from "@/components/audit-log";
import { AuthCta } from "@/components/auth-cta";
import { Leaderboard } from "@/components/leaderboard";
import { ModeToggle } from "@/components/mode-toggle";
import { PointsSummary } from "@/components/points-summary";
import { PushNotifications } from "@/components/push-notifications";
import { TaskActions } from "@/components/task-actions";
import { UserMenu } from "@/components/user-menu";
import { authOptions } from "@/lib/auth";
import {
	DURATION_BUCKETS,
	type DurationKey,
	LOG_KINDS,
	type LogKind,
	rewardThreshold,
} from "@/lib/points";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

const bucketLabelMap = Object.fromEntries(
	DURATION_BUCKETS.map((bucket) => [bucket.key, bucket.label]),
);
const isLogKind = (kind: string): kind is LogKind =>
	LOG_KINDS.includes(kind as LogKind);

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

	const [pointSums, taskCounts, rewardCounts, lastActivity, users, recentLogs] =
		await Promise.all([
			prisma.pointLog.groupBy({
				by: ["userId"],
				where: { revertedAt: null },
				_sum: { points: true },
			}),
			prisma.pointLog.groupBy({
				by: ["userId"],
				where: {
					revertedAt: null,
					kind: { in: ["PRESET", "TIMED"] },
				},
				_count: { _all: true },
			}),
			prisma.pointLog.groupBy({
				by: ["userId"],
				where: { revertedAt: null, kind: "REWARD" },
				_count: { _all: true },
			}),
			prisma.pointLog.groupBy({
				by: ["userId"],
				_max: { createdAt: true },
			}),
			prisma.user.findMany({
				select: { id: true, name: true, email: true, image: true },
				orderBy: { createdAt: "asc" },
			}),
			prisma.pointLog.findMany({
				include: {
					user: { select: { id: true, name: true, email: true } },
				},
				orderBy: { createdAt: "desc" },
				take: 30,
			}),
		]);

	const pointSumMap = new Map(
		pointSums.map((item) => [item.userId, item._sum.points ?? 0]),
	);
	const taskCountMap = new Map(
		taskCounts.map((item) => [item.userId, item._count._all]),
	);
	const rewardCountMap = new Map(
		rewardCounts.map((item) => [item.userId, item._count._all]),
	);
	const lastActivityMap = new Map(
		lastActivity.map((item) => [
			item.userId,
			item._max.createdAt?.toISOString() ?? null,
		]),
	);

	const leaderboardEntries = users
		.map((user) => ({
			userId: user.id,
			name: user.name ?? user.email ?? "Unknown player",
			email: user.email,
			points: pointSumMap.get(user.id) ?? 0,
			tasks: taskCountMap.get(user.id) ?? 0,
			claims: rewardCountMap.get(user.id) ?? 0,
			lastActivity: lastActivityMap.get(user.id),
		}))
		.sort((a, b) => b.points - a.points);

	const myPoints =
		leaderboardEntries.find((entry) => entry.userId === userId)?.points ?? 0;
	const myTasks = taskCountMap.get(userId) ?? 0;
	const myClaims = rewardCountMap.get(userId) ?? 0;

	const auditEntries = recentLogs.map((log) => {
		const kind = isLogKind(log.kind) ? log.kind : "PRESET";

		return {
			id: log.id,
			userName: log.user?.name ?? log.user?.email ?? "Unknown",
			description: log.description,
			points: log.points,
			kind,
			bucketLabel:
				kind === "REWARD"
					? "Reward"
					: (log.duration as DurationKey | null)
						? bucketLabelMap[log.duration as DurationKey]
						: null,
			createdAt: log.createdAt.toISOString(),
			revertedAt: log.revertedAt?.toISOString() ?? null,
		};
	});

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

				<TaskActions />

				<AuditLog entries={auditEntries} />

				<Leaderboard entries={leaderboardEntries} />

				<PushNotifications />
			</div>
		</main>
	);
}
