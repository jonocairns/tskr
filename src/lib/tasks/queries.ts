import "server-only";

import { buildAssignedTaskEntries } from "@/lib/dashboard/assigned";
import { getHouseholdAssignedTasks } from "@/lib/dashboard/queries";

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
		now,
		timeZone,
	});
};
