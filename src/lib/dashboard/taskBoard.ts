import type { HouseholdRole } from "@prisma/client";

export const shouldShowTaskBoard = (
	role: HouseholdRole,
	hasActiveAssignedTasks: boolean,
	householdDoneThisWeek: number,
) => role !== "DOER" || hasActiveAssignedTasks || householdDoneThisWeek > 0;
