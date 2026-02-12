import type { Prisma } from "@prisma/client";

export const getVisiblePresetWhere = (householdId: string, userId: string): Prisma.PresetTaskWhereInput => {
	return {
		householdId,
		OR: [{ isShared: true }, { createdById: userId }],
	};
};
