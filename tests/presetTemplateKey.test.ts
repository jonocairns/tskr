import { shouldClearTemplateKeyOnPresetUpdate } from "@/lib/presetTemplateKey";

test("clears templateKey when label changes", () => {
	const shouldClear = shouldClearTemplateKeyOnPresetUpdate({
		templateKey: "wash-dishes",
		currentLabel: "Wash dishes",
		currentBucket: "QUICK",
		nextLabel: "Dishes + wipe counters",
	});

	expect(shouldClear).toBe(true);
});

test("clears templateKey when bucket changes", () => {
	const shouldClear = shouldClearTemplateKeyOnPresetUpdate({
		templateKey: "wash-dishes",
		currentLabel: "Wash dishes",
		currentBucket: "QUICK",
		nextBucket: "ROUTINE",
	});

	expect(shouldClear).toBe(true);
});

test("keeps templateKey when neither label nor bucket changes", () => {
	const shouldClear = shouldClearTemplateKeyOnPresetUpdate({
		templateKey: "wash-dishes",
		currentLabel: "Wash dishes",
		currentBucket: "QUICK",
		nextLabel: "Wash dishes",
		nextBucket: "QUICK",
	});

	expect(shouldClear).toBe(false);
});

test("keeps null templateKey for non-template presets", () => {
	const shouldClear = shouldClearTemplateKeyOnPresetUpdate({
		templateKey: null,
		currentLabel: "Custom chore",
		currentBucket: "QUICK",
		nextLabel: "Custom chore renamed",
		nextBucket: "ROUTINE",
	});

	expect(shouldClear).toBe(false);
});
