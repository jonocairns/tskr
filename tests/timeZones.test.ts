import { getTimeZoneOptions, isValidTimeZone } from "@/lib/timeZones";

test("includes UTC in time zone options", () => {
	const options = getTimeZoneOptions();

	expect(options.includes("UTC")).toBe(true);
});

test("accepts UTC as a valid time zone", () => {
	expect(isValidTimeZone("UTC")).toBe(true);
});
