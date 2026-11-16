import type { AssignedTaskEntry } from "@/components/AssignedTaskTable";
import { computeAssignedTaskState, getAssignedTaskPeriodBounds } from "@/lib/assignedTasks";
import { DURATION_KEYS, type DurationKey, getBucketPoints } from "@/lib/points";

type AssignedTaskRecord = {
	id: string;
	assignedAt: Date;
	status: string;
	assignedTo: { id: string; name: string | null; email: string | null } | null;
	cadenceTarget: number;
	cadenceIntervalMinutes: number;
	isRecurring: boolean;
	preset: { id: string; label: string; bucket: string } | null;
	logs: Array<{ createdAt: Date; status: string; user: { id: string; name: string | null; email: string | null } }>;
};

const isDurationKey = (bucket: string): bucket is DurationKey => DURATION_KEYS.includes(bucket as DurationKey);

type BuildAssignedTaskEntriesInput = {
	tasks: AssignedTaskRecord[];
	userId: string;
	now?: Date;
	timeZone: string;
};

export const buildAssignedTaskEntries = ({
	tasks,
	userId,
	now = new Date(),
	timeZone,
}: BuildAssignedTaskEntriesInput) => {
	return tasks.flatMap((task) => {
		if (task.status !== "ACTIVE" || !task.preset || task.assignedAt > now) {
			return [];
		}

		const bucket = isDurationKey(task.preset.bucket) ? task.preset.bucket : "QUICK";
		const state = computeAssignedTaskState({
			task: {
				cadenceTarget: task.cadenceTarget,
				cadenceIntervalMinutes: task.cadenceIntervalMinutes,
				isRecurring: task.isRecurring,
			},
			logs: task.logs,
			now,
			timeZone,
		});

		const period = getAssignedTaskPeriodBounds(now, task.cadenceIntervalMinutes, timeZone);
		const pendingUsers = new Map(
			task.logs
				.filter(
					(log) =>
						log.status === "PENDING" &&
						(!task.isRecurring || (log.createdAt >= period.periodStart && log.createdAt < period.periodEnd)),
				)
				.map((log) => [log.user.id, log.user.name ?? log.user.email]),
		);

		if (!state.isActive && pendingUsers.size === 0) {
			return [];
		}

		const progress = Math.min(state.progress, task.cadenceTarget);
		let completedLastCycle = false;
		if (task.isRecurring) {
			const { periodStart } = getAssignedTaskPeriodBounds(now, task.cadenceIntervalMinutes, timeZone);
			const previous = getAssignedTaskPeriodBounds(
				new Date(periodStart.getTime() - 1),
				task.cadenceIntervalMinutes,
				timeZone,
			);
			const previousCount = task.logs.filter(
				(log) => log.createdAt >= previous.periodStart && log.createdAt < previous.periodEnd,
			).length;
			completedLastCycle = previousCount >= Math.max(task.cadenceTarget, 1);
		}
		const lastCompletedAt = task.logs.reduce<Date | null>(
			(latest, log) => (log.createdAt <= now && (!latest || log.createdAt > latest) ? log.createdAt : latest),
			null,
		);

		return [
			{
				id: task.id,
				group: !task.assignedTo ? "open" : task.assignedTo.id === userId ? "mine" : "others",
				assigneeLabel: task.assignedTo?.name ?? task.assignedTo?.email ?? null,
				state: state.isActive ? "available" : "awaitingApproval",
				pendingCompleters: Array.from(pendingUsers.values()),
				presetId: task.preset.id,
				label: task.preset.label,
				bucket,
				points: getBucketPoints(bucket),
				assignedAt: task.assignedAt.toISOString(),
				cadenceTarget: task.cadenceTarget,
				cadenceIntervalMinutes: task.cadenceIntervalMinutes,
				isRecurring: task.isRecurring,
				progress,
				completedLastCycle,
				lastCompletedAt: lastCompletedAt?.toISOString() ?? null,
				nextResetAt: state.nextResetAt?.toISOString() ?? null,
			},
		] satisfies AssignedTaskEntry[];
	});
};
