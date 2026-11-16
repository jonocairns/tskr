import { validatePresetReorderPayload } from "../src/lib/presetReorderValidation";

test("returns BAD_REQUEST for duplicate preset ids", () => {
	const result = validatePresetReorderPayload({
		orderedPresetIds: ["a", "a"],
		visiblePresetIds: ["a", "b"],
	});

	expect(result).toEqual({
		ok: false,
		code: "BAD_REQUEST",
		message: "Quick log order contains a duplicate task",
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
		message: "No quick log tasks available to reorder",
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
		message: "Quick log order must include all visible tasks",
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
		message: "Quick log task not found",
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
