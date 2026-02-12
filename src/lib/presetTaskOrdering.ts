type PresetOrderRecord = {
	presetId: string;
	sortOrder: number;
};

type PresetWithIdentity = {
	id: string;
	createdAt: Date;
};

export const applyUserPresetOrdering = <TPreset extends PresetWithIdentity>(
	presets: TPreset[],
	presetOrders: PresetOrderRecord[],
) => {
	const sortOrderByPresetId = new Map(presetOrders.map((presetOrder) => [presetOrder.presetId, presetOrder.sortOrder]));

	return [...presets]
		.sort((a, b) => {
			const aSortOrder = sortOrderByPresetId.get(a.id);
			const bSortOrder = sortOrderByPresetId.get(b.id);

			if (aSortOrder !== undefined && bSortOrder !== undefined) {
				if (aSortOrder !== bSortOrder) {
					return aSortOrder - bSortOrder;
				}
			} else if (aSortOrder !== undefined) {
				return -1;
			} else if (bSortOrder !== undefined) {
				return 1;
			}

			const createdAtDifference = a.createdAt.getTime() - b.createdAt.getTime();
			if (createdAtDifference !== 0) {
				return createdAtDifference;
			}

			return a.id.localeCompare(b.id);
		})
		.map((preset, index) => ({
			...preset,
			sortOrder: index,
		}));
};
