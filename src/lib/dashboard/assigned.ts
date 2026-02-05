import type { AssignedTaskEntry } from "@/components/AssignedTaskQueue";
import { computeAssignedTaskState } from "@/lib/assignedTasks";
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

export const buildAssignedTaskEntries = ({
	tasks,
	now = new Date(),
	timeZone,
}: BuildAssignedTaskEntriesInput): AssignedTaskEntry[] => {
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
			},
		];
	});
};
