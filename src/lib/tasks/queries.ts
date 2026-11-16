import "server-only";

import { computeAssignedTaskState } from "@/lib/assignedTasks";
import { buildAssignedTaskEntries } from "@/lib/dashboard/assigned";
import { mapPresetSummaries } from "@/lib/dashboard/presets";
import { getHouseholdAssignedTasks } from "@/lib/dashboard/queries";
import { applyUserPresetOrdering } from "@/lib/presetTaskOrdering";
import { prisma } from "@/lib/prisma";

export const getTasksTodoData = async ({
	householdId,
	actingUserId,
	userId,
	now = new Date(),
	timeZone,
}: {
	householdId: string;
	actingUserId: string;
	userId: string;
	now?: Date;
	timeZone: string;
}) => {
	const tasks = await getHouseholdAssignedTasks(householdId);
	return buildAssignedTaskEntries({
		tasks: tasks.filter((task) => userId === "all" || task.assignedToId === userId || task.assignedToId === null),
		userId: actingUserId,
		groupRelativeToUserId: userId === "all" ? undefined : userId,
		now,
		timeZone,
	});
};

// The page resolves the viewer's role before selecting this management-only loader.
export const getTasksManageData = async ({
	householdId,
	userId,
	timeZone,
	now = new Date(),
}: {
	householdId: string;
	userId: string;
	timeZone: string;
	now?: Date;
}) => {
	const [members, presets, presetOrders, assignedTasks] = await Promise.all([
		prisma.user.findMany({
			where: { memberships: { some: { householdId } } },
			select: { id: true, name: true, email: true },
			orderBy: { createdAt: "asc" },
		}),
		prisma.presetTask.findMany({
			where: { householdId, isShared: true, archivedAt: null },
			orderBy: { createdAt: "asc" },
			select: {
				id: true,
				label: true,
				bucket: true,
				templateKey: true,
				iconKey: true,
				isShared: true,
				createdById: true,
				approvalOverride: true,
				createdAt: true,
			},
		}),
		prisma.presetTaskOrder.findMany({
			where: { householdId, userId },
			select: {
				presetId: true,
				sortOrder: true,
			},
		}),
		getHouseholdAssignedTasks(householdId),
	]);

	const presetSummaries = mapPresetSummaries(applyUserPresetOrdering(presets, presetOrders));
	const assignedTaskEntries = assignedTasks.map((task) => ({
		id: task.id,
		presetId: task.presetId,
		presetLabel: task.preset.label,
		assigneeId: task.assignedTo?.id ?? null,
		assigneeName: task.assignedTo?.name ?? null,
		assigneeEmail: task.assignedTo?.email ?? null,
		cadenceTarget: task.cadenceTarget,
		cadenceIntervalMinutes: task.cadenceIntervalMinutes,
		isRecurring: task.isRecurring,
		assignedAt: task.assignedAt.toISOString(),
		progress: {
			completed: computeAssignedTaskState({ task, logs: task.logs, now, timeZone }).progress,
			target: Math.max(task.cadenceTarget, 1),
			isRecurring: task.isRecurring,
		},
	}));

	return { members, presets: presetSummaries, tasks: assignedTaskEntries };
};
