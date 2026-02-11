import { applyUserPresetOrdering } from "../src/lib/presetTaskOrdering";

const makePreset = (id: string, createdAt: string) => ({
	id,
	createdAt: new Date(createdAt),
});

test("applies explicit per-user order before createdAt fallback", () => {
	const presets = [
		makePreset("preset-a", "2024-01-01T00:00:00.000Z"),
		makePreset("preset-b", "2024-01-02T00:00:00.000Z"),
		makePreset("preset-c", "2024-01-03T00:00:00.000Z"),
	];

	const ordered = applyUserPresetOrdering(presets, [
		{ presetId: "preset-c", sortOrder: 0 },
		{ presetId: "preset-a", sortOrder: 1 },
	]);

	expect(ordered.map((preset) => preset.id)).toEqual(["preset-c", "preset-a", "preset-b"]);
	expect(ordered.map((preset) => preset.sortOrder)).toEqual([0, 1, 2]);
});

test("falls back to createdAt order when no user rows exist", () => {
	const presets = [
		makePreset("preset-b", "2024-01-02T00:00:00.000Z"),
		makePreset("preset-a", "2024-01-01T00:00:00.000Z"),
	];

	const ordered = applyUserPresetOrdering(presets, []);

	expect(ordered.map((preset) => preset.id)).toEqual(["preset-a", "preset-b"]);
	expect(ordered.map((preset) => preset.sortOrder)).toEqual([0, 1]);
});
