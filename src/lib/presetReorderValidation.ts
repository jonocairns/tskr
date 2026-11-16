type PresetReorderValidationInput = {
	orderedPresetIds: string[];
	visiblePresetIds: string[];
};

type PresetReorderValidationSuccess = {
	ok: true;
	uniquePresetIds: string[];
};

type PresetReorderValidationFailure = {
	ok: false;
	code: "BAD_REQUEST" | "NOT_FOUND";
	message: string;
};

export const validatePresetReorderPayload = ({
	orderedPresetIds,
	visiblePresetIds,
}: PresetReorderValidationInput): PresetReorderValidationSuccess | PresetReorderValidationFailure => {
	const uniquePresetIds = [...new Set(orderedPresetIds)];

	if (uniquePresetIds.length !== orderedPresetIds.length) {
		return {
			ok: false,
			code: "BAD_REQUEST",
			message: "Quick log order contains a duplicate task",
		};
	}

	if (visiblePresetIds.length === 0) {
		return {
			ok: false,
			code: "BAD_REQUEST",
			message: "No quick log tasks available to reorder",
		};
	}

	if (uniquePresetIds.length !== visiblePresetIds.length) {
		return {
			ok: false,
			code: "BAD_REQUEST",
			message: "Quick log order must include all visible tasks",
		};
	}

	const visiblePresetIdSet = new Set(visiblePresetIds);
	const includesUnknownPreset = uniquePresetIds.some((presetId) => !visiblePresetIdSet.has(presetId));
	if (includesUnknownPreset) {
		return {
			ok: false,
			code: "NOT_FOUND",
			message: "Quick log task not found",
		};
	}

	return {
		ok: true,
		uniquePresetIds,
	};
};
