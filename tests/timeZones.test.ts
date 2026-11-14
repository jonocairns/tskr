import { getStartOfWeekInTimeZone, getTimeZoneOptions, isValidTimeZone } from "@/lib/timeZones";

test("includes UTC in time zone options", () => {
	const options = getTimeZoneOptions();

	expect(options.includes("UTC")).toBe(true);
});

test("accepts UTC as a valid time zone", () => {
	expect(isValidTimeZone("UTC")).toBe(true);
});

test.each([
	["2024-09-29T10:59:59.999Z", "2024-09-22T12:00:00.000Z"], // DST Sunday, before local Monday
	["2024-09-29T11:00:00.000Z", "2024-09-29T11:00:00.000Z"], // exactly Monday after a 167-hour week
	["2024-04-07T11:59:59.999Z", "2024-03-31T11:00:00.000Z"], // end of a 169-hour week
	["2024-04-07T12:00:00.000Z", "2024-04-07T12:00:00.000Z"],
])("calendar-week counts use household Monday across DST (%s)", (now, expectedStart) => {
	expect(getStartOfWeekInTimeZone(new Date(now), "Pacific/Auckland").toISOString()).toBe(expectedStart);
});
