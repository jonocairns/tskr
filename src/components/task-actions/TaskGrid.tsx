import { PlusIcon } from "lucide-react";

import { TaskButton } from "@/components/task-actions/TaskButton";
import type { PresetOption } from "@/components/task-actions/types";
import { Button } from "@/components/ui/Button";
import { useTranslation } from "@/lib/i18nClient";

type TaskGridProps = {
	presetOptions: PresetOption[];
	filteredPresets: PresetOption[];
	disabled: boolean;
	onTaskClick: (taskId: string) => void;
	onOneOffClick: () => void;
	isEditMode?: boolean;
	onTaskEdit?: (taskId: string) => void;
	onTaskDelete?: (taskId: string) => void;
	canDeleteTask?: (taskId: string) => boolean;
};

export const TaskGrid = ({
	presetOptions,
	filteredPresets,
	disabled,
	onTaskClick,
	onOneOffClick,
	isEditMode = false,
	onTaskEdit,
	onTaskDelete,
	canDeleteTask,
}: TaskGridProps) => {
	const { t } = useTranslation();
	const hasNoSavedTasks = presetOptions.length === 0;
	const hasNoMatchingTasks = !hasNoSavedTasks && filteredPresets.length === 0;

	return (
		<div>
			<div className="grid auto-rows-fr gap-3 sm:grid-cols-2 xl:grid-cols-3">
				<Button
					variant="outline"
					className="group flex min-h-20 w-full flex-col items-start justify-start gap-1 rounded-xl border-dashed border-primary/40 bg-gradient-to-br from-primary/10 via-background to-background px-3 py-3 text-left shadow-sm transition hover:-translate-y-0.5 hover:border-primary hover:from-primary/15 hover:shadow-md"
					onClick={onOneOffClick}
					disabled={disabled}
				>
					<div className="flex items-center gap-2">
						<div className="rounded-md bg-white p-1.5 transition-colors group-hover:bg-white/90">
							<PlusIcon className="h-4 w-4 text-black" />
						</div>
						<span className="font-semibold">{isEditMode ? t("Create new chore") : t("Log one off task")}</span>
					</div>
					<span className="text-xs font-medium leading-tight text-muted-foreground">
						{isEditMode ? t("Open task form") : t("Log something not in your saved tasks")}
					</span>
				</Button>
				{hasNoSavedTasks || hasNoMatchingTasks
					? null
					: filteredPresets.map((task) => (
							<TaskButton
								key={task.id}
								id={task.id}
								label={task.label}
								bucket={task.bucket}
								iconKey={task.iconKey}
								disabled={disabled}
								onClick={onTaskClick}
								isEditMode={isEditMode}
								onEdit={onTaskEdit}
								onDelete={onTaskDelete}
								canDelete={canDeleteTask?.(task.id) ?? false}
							/>
						))}
			</div>
			{hasNoSavedTasks ? <p className="pt-4 text-xs text-muted-foreground">{t("No saved tasks yet.")}</p> : null}
			{hasNoMatchingTasks ? (
				<p className="pt-4 text-xs text-muted-foreground">{t("No tasks match that search.")}</p>
			) : null}
		</div>
	);
};
