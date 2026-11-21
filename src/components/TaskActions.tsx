"use client";

import type { ReactNode } from "react";

import { TaskActionsProvider } from "@/components/task-actions/Context";
import { PresetActionsCard } from "@/components/task-actions/PresetActionsCard";
import type { PresetSummary } from "@/components/task-actions/types";

type TaskActionsProps = {
	householdId: string;
	presets: PresetSummary[];
	currentUserId: string;
	currentUserRole: "DICTATOR" | "APPROVER" | "DOER";
	/** Shown in the Quick log header outside edit mode. */
	headerAction?: ReactNode;
};

export const TaskActions = ({
	householdId,
	presets,
	currentUserId,
	currentUserRole,
	headerAction,
}: TaskActionsProps) => {
	return (
		<TaskActionsProvider
			householdId={householdId}
			presets={presets}
			currentUserId={currentUserId}
			currentUserRole={currentUserRole}
		>
			<div className="grid gap-4">
				<PresetActionsCard headerAction={headerAction} />
			</div>
		</TaskActionsProvider>
	);
};
