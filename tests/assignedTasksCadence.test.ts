import { formatCadenceInterval } from "../src/lib/assignedTasksCadence";

test("returns labels for known cadence intervals", () => {
	expect(formatCadenceInterval(1440)).toBe("Daily");
	expect(formatCadenceInterval(10080)).toBe("Weekly");
});

test("returns minute-based labels for non-hour multiples", () => {
	expect(formatCadenceInterval(90)).toBe("Every 90m");
	expect(formatCadenceInterval(121)).toBe("Every 121m");
});

test("returns hour-based labels for exact hour multiples", () => {
	expect(formatCadenceInterval(60)).toBe("Every 1h");
	expect(formatCadenceInterval(120)).toBe("Every 2h");
});
