import type { AssignedTaskEntry } from "@/components/AssignedTaskQueue";
import { computeAssignedTaskState, getAssignedTaskPeriodBounds } from "@/lib/assignedTasks";
import { DURATION_KEYS, type DurationKey, getBucketPoints } from "@/lib/points";

type AssignedTaskRecord = {
	id: string;
	assignedAt: Date;
	status: string;
	cadenceTarget: number;
	cadenceIntervalMinutes: number;
	isRecurring: boolean;
	preset: { id: string; label: string; bucket: string } | null;
	logs: Array<{ createdAt: Date }>;
};

const isDurationKey = (bucket: string): bucket is DurationKey => DURATION_KEYS.includes(bucket as DurationKey);

type BuildAssignedTaskEntriesInput = {
	tasks: AssignedTaskRecord[];
	now?: Date;
	timeZone: string;
};

export const buildAssignedTaskEntries = ({ tasks, now = new Date(), timeZone }: BuildAssignedTaskEntriesInput) => {
	return tasks.flatMap((task) => {
		if (task.status !== "ACTIVE" || !task.preset) {
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

		if (!state.isActive) {
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
