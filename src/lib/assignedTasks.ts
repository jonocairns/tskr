export type AssignedTaskLog = {
	createdAt: Date;
};

export type AssignedTaskConfig = {
	cadenceTarget: number;
	cadenceIntervalMinutes: number;
	isRecurring: boolean;
};

export type AssignedTaskState = {
	progress: number;
	isActive: boolean;
	nextResetAt: Date | null;
};

const startOfDay = (date: Date) => {
	const start = new Date(date);
	start.setHours(0, 0, 0, 0);
	return start;
};

export function computeAssignedTaskState(
	task: AssignedTaskConfig,
	logs: AssignedTaskLog[],
	now = new Date(),
): AssignedTaskState {
	const target = Math.max(task.cadenceTarget, 1);
	const intervalMinutes = Math.max(task.cadenceIntervalMinutes, 1);
	const intervalMs = intervalMinutes * 60_000;
	const sortedLogs = [...logs].sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime());

	if (sortedLogs.length === 0) {
		return { progress: 0, isActive: true, nextResetAt: null };
	}

	const totalCount = sortedLogs.length;

	if (!task.isRecurring) {
		return totalCount >= target
			? { progress: target, isActive: false, nextResetAt: null }
			: { progress: totalCount, isActive: true, nextResetAt: null };
	}

	if (totalCount < target) {
		return { progress: totalCount, isActive: true, nextResetAt: null };
	}

	const completedCount = Math.floor(totalCount / target) * target;
	const lastCompletionLog = sortedLogs[completedCount - 1];
	if (!lastCompletionLog) {
		return { progress: totalCount, isActive: true, nextResetAt: null };
	}

	const shouldRoundToDayBoundary = intervalMinutes >= 1440 && intervalMinutes % 1440 === 0;
	const resetAnchor = shouldRoundToDayBoundary ? startOfDay(lastCompletionLog.createdAt) : lastCompletionLog.createdAt;
	const nextResetAt = new Date(resetAnchor.getTime() + intervalMs);
	if (now < nextResetAt) {
		return { progress: target, isActive: false, nextResetAt };
	}

	return {
		progress: totalCount - completedCount,
		isActive: true,
		nextResetAt,
	};
}
