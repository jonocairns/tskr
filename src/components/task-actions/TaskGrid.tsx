import { TaskButton } from "@/components/task-actions/TaskButton";
import type { PresetOption } from "@/components/task-actions/types";

type TaskGridProps = {
	presetOptions: PresetOption[];
	filteredPresets: PresetOption[];
	disabled: boolean;
	onTaskClick: (taskId: string) => void;
};

export const TaskGrid = ({ presetOptions, filteredPresets, disabled, onTaskClick }: TaskGridProps) => {
	return (
		<div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
			{presetOptions.length === 0 ? (
				<p className="text-sm text-muted-foreground sm:col-span-2 lg:col-span-3">No saved tasks yet.</p>
			) : filteredPresets.length === 0 ? (
				<p className="text-sm text-muted-foreground sm:col-span-2 lg:col-span-3">No tasks match that search.</p>
			) : (
				filteredPresets.map((task) => (
					<TaskButton
						key={task.id}
						id={task.id}
						label={task.label}
						bucket={task.bucket}
						disabled={disabled}
						onClick={onTaskClick}
					/>
				))
			)}
		</div>
	);
};
