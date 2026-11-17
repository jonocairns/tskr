"use client";

import { type ComponentProps, useEffect, useState } from "react";

import { AssignedTasksManager } from "@/components/AssignedTasksManager";
import { AssignTaskCard } from "@/components/AssignTaskCard";

const HIGHLIGHT_MS = 3000;

type ManageTasksPanelProps = Omit<
	ComponentProps<typeof AssignTaskCard>,
	"existingTasks" | "onTaskAdded" | "onViewTask"
> & {
	tasks: ComponentProps<typeof AssignedTasksManager>["initialTasks"];
};

// Links the add form to the task list so a newly added row is briefly highlighted and can be revealed.
export const ManageTasksPanel = ({ householdId, members, presets, tasks, currentUserId }: ManageTasksPanelProps) => {
	const [highlightTaskId, setHighlightTaskId] = useState<string | null>(null);
	const [revealRequest, setRevealRequest] = useState<{ id: string; count: number } | null>(null);
	const highlightVisible = highlightTaskId !== null && tasks.some((task) => task.id === highlightTaskId);

	// The row arrives with the refreshed server props, so the timer starts once it is rendered and
	// restarts for each new row.
	useEffect(() => {
		if (!highlightTaskId || !highlightVisible) {
			return;
		}
		const timeout = setTimeout(() => setHighlightTaskId(null), HIGHLIGHT_MS);
		return () => clearTimeout(timeout);
	}, [highlightTaskId, highlightVisible]);

	const handleViewTask = (assignedTaskId: string) => {
		setRevealRequest((previous) => ({ id: assignedTaskId, count: (previous?.count ?? 0) + 1 }));
		// Clearing first lets the highlight animation replay on the revealed row.
		setHighlightTaskId(null);
		requestAnimationFrame(() => setHighlightTaskId(assignedTaskId));
	};

	return (
		<>
			<AssignTaskCard
				householdId={householdId}
				members={members}
				presets={presets}
				existingTasks={tasks}
				currentUserId={currentUserId}
				onTaskAdded={setHighlightTaskId}
				onViewTask={handleViewTask}
			/>
			<AssignedTasksManager
				householdId={householdId}
				initialTasks={tasks}
				members={members}
				highlightTaskId={highlightTaskId}
				revealRequest={revealRequest}
			/>
		</>
	);
};
