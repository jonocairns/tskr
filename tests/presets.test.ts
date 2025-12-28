import { mapPresetSummaries } from "../src/lib/dashboard/presets";

type PresetRecord = Parameters<typeof mapPresetSummaries>[0][number];

const makePreset = (overrides: Partial<PresetRecord> = {}): PresetRecord => ({
	id: "preset-1",
	label: "Cleanup",
	bucket: "QUICK",
	isShared: false,
	createdById: "user-1",
	approvalOverride: null,
	createdAt: new Date("2024-01-02T03:04:05.000Z"),
	...overrides,
});

test("normalizes approval override and formats createdAt", () => {
	const presets = [
		makePreset({ approvalOverride: "REQUIRE" }),
		makePreset({ id: "preset-2", approvalOverride: "OTHER" }),
	];

	const summaries = mapPresetSummaries(presets);

	expect(summaries[0]?.approvalOverride).toBe("REQUIRE");
	expect(summaries[1]?.approvalOverride).toBeNull();
	expect(summaries[0]?.createdAt).toBe("2024-01-02T03:04:05.000Z");
});

test("casts bucket values through to the summary", () => {
	const summaries = mapPresetSummaries([makePreset({ bucket: "CUSTOM" })]);

	expect(summaries[0]?.bucket).toBe("CUSTOM");
});
