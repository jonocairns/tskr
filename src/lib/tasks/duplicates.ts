export type DuplicateTask = {
	presetId: string;
	presetLabel: string;
	assigneeId: string | null;
};

export const findDuplicateTask = <T extends DuplicateTask>({
	tasks,
	presetId,
	label,
	assigneeId,
}: {
	tasks: T[];
	presetId: string | null;
	label: string;
	assigneeId: string | null;
}) =>
	tasks.find(
		(task) =>
			task.assigneeId === assigneeId &&
			(presetId !== null
				? task.presetId === presetId
				: !!label.trim() && task.presetLabel.trim().toLowerCase() === label.trim().toLowerCase()),
	);
