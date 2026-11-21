import { formatReadableDate, formatRelativeWhen } from "../src/lib/formatDate";

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

describe("formatRelativeWhen", () => {
	const timeZone = "Pacific/Auckland";
	// Sat 21 Nov 2026, 10:00 in Auckland (UTC+13).
	const now = new Date("2026-11-20T21:00:00.000Z");
	const t = (key: string, options?: Record<string, unknown>) =>
		key.replace(/\{\{(\w+)\}\}/g, (_match, name: string) => String(options?.[name] ?? ""));
	const when = (
		value: string,
		options: { dateFormat?: "DMY" | "MDY" | "YMD"; timeFormat?: "H12" | "H24"; now?: Date } = {},
	) =>
		formatRelativeWhen(value, {
			t,
			timeZone,
			dateFormat: options.dateFormat ?? "DMY",
			timeFormat: options.timeFormat ?? "H24",
			now: options.now ?? now,
		});
	const nbsp = (value: string) => value.replaceAll(" ", " ");

	test("drops the time at household midnight", () => {
		expect(when("2026-11-21T11:00:00.000Z")).toEqual({ text: "tomorrow", hasTime: false }); // Sun 22 Nov 00:00
		expect(when("2026-11-22T11:00:00.000Z")).toEqual({ text: "on Monday", hasTime: false });
		expect(when("2026-11-26T11:00:00.000Z")).toEqual({ text: "on Friday", hasTime: false });
		// Seven days out is the same weekday as today, so it names the date instead.
		expect(when("2026-11-27T11:00:00.000Z")).toEqual({ text: `on ${nbsp("Sat 28 Nov")}`, hasTime: false });
		expect(when("2026-11-30T11:00:00.000Z")).toEqual({ text: `on ${nbsp("Tue 1 Dec")}`, hasTime: false });
	});

	test("includes the time otherwise", () => {
		expect(when("2026-11-21T01:01:00.000Z").text).toBe(`today at ${nbsp("14:01")}`);
		expect(when("2026-11-21T01:01:00.000Z", { timeFormat: "H12" }).text).toBe(`today at ${nbsp("2:01 PM")}`);
		expect(when("2026-11-22T01:01:00.000Z")).toEqual({ text: `tomorrow at ${nbsp("14:01")}`, hasTime: true });
		expect(when("2026-11-23T01:01:00.000Z").text).toBe(`on Monday at ${nbsp("14:01")}`);
		expect(when("2026-12-01T01:01:00.000Z", { timeFormat: "H12" }).text).toBe(
			`on ${nbsp("Tue 1 Dec")} at ${nbsp("2:01 PM")}`,
		);
	});

	test("measures days in the household time zone", () => {
		// 23:30 on Sat 21 Nov in Auckland is still today there, though it is already Sunday in UTC terms elsewhere.
		expect(when("2026-11-21T10:30:00.000Z").text).toBe(`today at ${nbsp("23:30")}`);
		// A minute past midnight is a rolling time, not a calendar boundary.
		expect(when("2026-11-21T11:01:00.000Z")).toEqual({ text: `tomorrow at ${nbsp("00:01")}`, hasTime: true });
	});

	test("adds the year only outside the current one", () => {
		const lateDecember = new Date("2026-12-27T21:00:00.000Z"); // Mon 28 Dec 2026, 10:00
		expect(when("2026-12-31T11:00:00.000Z", { now: lateDecember }).text).toBe("on Friday"); // Fri 1 Jan 2027 00:00 is 4 days out
		expect(when("2027-01-04T11:00:00.000Z", { now: lateDecember }).text).toBe(`on ${nbsp("Tue 5 Jan 2027")}`);
		expect(when("2027-01-04T11:00:00.000Z", { now: lateDecember, dateFormat: "MDY" }).text).toBe(
			`on ${nbsp("Tue, Jan 5, 2027")}`,
		);
	});

	test("follows the household date format", () => {
		expect(when("2026-11-30T11:00:00.000Z", { dateFormat: "MDY" }).text).toBe(`on ${nbsp("Tue, Dec 1")}`);
		expect(when("2026-11-30T11:00:00.000Z", { dateFormat: "YMD" }).text).toBe("on 2026-12-01");
	});
});
