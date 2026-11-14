import { formatCadenceInterval, getBucketLabels } from "../src/lib/assignedTasksCadence";

const t = (key: string, options?: Record<string, unknown>) =>
	key.replace(/\{\{(\w+)\}\}/g, (_, name: string) => String(options?.[name] ?? ""));

test("returns labels for known cadence intervals", () => {
	expect(formatCadenceInterval(1440, t)).toBe("Daily");
	expect(formatCadenceInterval(10080, t)).toBe("Weekly");
});

test("returns minute-based labels for non-hour multiples", () => {
	expect(formatCadenceInterval(90, t)).toBe("Every 90m");
	expect(formatCadenceInterval(121, t)).toBe("Every 121m");
});

test("returns hour-based labels for exact hour multiples", () => {
	expect(formatCadenceInterval(60, t)).toBe("Every 1h");
	expect(formatCadenceInterval(120, t)).toBe("Every 2h");
});

test("translates every bucket label", () => {
	expect(getBucketLabels(t)).toEqual({
		TINY: "Tiny",
		QUICK: "Quick",
		ROUTINE: "Routine",
		CHALLENGING: "Challenging",
		HEAVY: "Heavy",
		MAJOR: "Major",
	});
});
