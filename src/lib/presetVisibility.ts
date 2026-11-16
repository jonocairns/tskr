// Current Quick log items only; historical relations retain archived items.

export const getVisiblePresetWhere = (householdId: string, userId: string) => {
	return {
		householdId,
		archivedAt: null,
		OR: [{ isShared: true }, { createdById: userId }],
	};
};
