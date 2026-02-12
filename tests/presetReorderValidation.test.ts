import { validatePresetReorderPayload } from "../src/lib/presetReorderValidation";

test("returns BAD_REQUEST for duplicate preset ids", () => {
	const result = validatePresetReorderPayload({
		orderedPresetIds: ["a", "a"],
		visiblePresetIds: ["a", "b"],
	});

	expect(result).toEqual({
		ok: false,
		code: "BAD_REQUEST",
		message: "Duplicate preset id in reorder payload",
	});
});

test("returns BAD_REQUEST when there are no visible presets", () => {
	const result = validatePresetReorderPayload({
		orderedPresetIds: ["a"],
		visiblePresetIds: [],
	});

	expect(result).toEqual({
		ok: false,
		code: "BAD_REQUEST",
		message: "No presets available to reorder",
	});
});

test("returns BAD_REQUEST when payload omits visible presets", () => {
	const result = validatePresetReorderPayload({
		orderedPresetIds: ["a"],
		visiblePresetIds: ["a", "b"],
	});

	expect(result).toEqual({
		ok: false,
		code: "BAD_REQUEST",
		message: "Reorder payload must include all visible presets",
	});
});

test("returns NOT_FOUND when payload includes unknown presets", () => {
	const result = validatePresetReorderPayload({
		orderedPresetIds: ["a", "c"],
		visiblePresetIds: ["a", "b"],
	});

	expect(result).toEqual({
		ok: false,
		code: "NOT_FOUND",
		message: "Preset not found",
	});
});

test("returns normalized ids for a valid payload", () => {
	const result = validatePresetReorderPayload({
		orderedPresetIds: ["b", "a"],
		visiblePresetIds: ["a", "b"],
	});

	expect(result).toEqual({
		ok: true,
		uniquePresetIds: ["b", "a"],
	});
});
