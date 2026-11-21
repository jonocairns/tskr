import { formatReadableDate } from "../src/lib/formatDate";

describe("formatReadableDate", () => {
	const date = "2026-11-30T11:00:00.000Z"; // Tue 1 Dec 2026, 00:00 in Pacific/Auckland (UTC+13)
	const timeZone = "Pacific/Auckland";

	test("defaults to day-first order", () => {
		expect(formatReadableDate(date, { timeZone })).toBe("Tue 1 Dec");
		expect(formatReadableDate(date, { timeZone, includeYear: true })).toBe("Tue 1 Dec 2026");
	});

	test("follows month-first households", () => {
		expect(formatReadableDate(date, { timeZone, dateFormat: "MDY" })).toBe("Tue, Dec 1");
		expect(formatReadableDate(date, { timeZone, dateFormat: "MDY", includeYear: true })).toBe("Tue, Dec 1, 2026");
	});

	test("keeps numeric dates for year-first households", () => {
		expect(formatReadableDate(date, { timeZone, dateFormat: "YMD" })).toBe("2026-12-01");
	});
});
