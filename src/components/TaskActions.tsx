"use client";

import { TaskActionsProvider } from "@/components/task-actions/Context";
import { PresetActionsCard } from "@/components/task-actions/PresetActionsCard";
import type { PresetSummary } from "@/components/task-actions/types";

type TaskActionsProps = {
	presets: PresetSummary[];
	currentUserId: string;
	currentUserRole: "DICTATOR" | "APPROVER" | "DOER";
};

export const TaskActions = ({
	presets,
	currentUserId,
	currentUserRole,
}: TaskActionsProps) => {
	return (
		<TaskActionsProvider
			presets={presets}
			currentUserId={currentUserId}
			currentUserRole={currentUserRole}
		>
			<div className="grid gap-4">
				<PresetActionsCard />
			</div>
		</TaskActionsProvider>
	);
};
