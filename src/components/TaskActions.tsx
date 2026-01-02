"use client";

import { TaskActionsProvider } from "@/components/task-actions/Context";
import { PresetActionsCard } from "@/components/task-actions/PresetActionsCard";
import type { PresetSummary } from "@/components/task-actions/types";

type TaskActionsProps = {
	householdId: string;
	presets: PresetSummary[];
	currentUserId: string;
	currentUserRole: "DICTATOR" | "APPROVER" | "DOER";
};

export const TaskActions = ({ householdId, presets, currentUserId, currentUserRole }: TaskActionsProps) => {
	return (
		<TaskActionsProvider
			householdId={householdId}
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
