"use client";

import { TaskActionsProvider } from "@/components/task-actions/Context";
import { PresetActionsCard } from "@/components/task-actions/PresetActionsCard";
import type { PresetSummary } from "@/components/task-actions/types";

type TaskActionsProps = {
	presets: PresetSummary[];
	currentUserId: string;
};

export const TaskActions = ({ presets, currentUserId }: TaskActionsProps) => {
	return (
		<TaskActionsProvider presets={presets} currentUserId={currentUserId}>
			<div className="grid gap-4">
				<PresetActionsCard />
			</div>
		</TaskActionsProvider>
	);
};
