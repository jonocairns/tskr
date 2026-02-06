import { Temporal } from "@js-temporal/polyfill";

export const DEFAULT_TIME_ZONE = "Pacific/Auckland";

const FALLBACK_TIME_ZONES = [
	"Pacific/Auckland",
	"Pacific/Chatham",
	"UTC",
	"Australia/Sydney",
	"Australia/Melbourne",
	"America/Los_Angeles",
	"America/Denver",
	"America/Chicago",
	"America/New_York",
	"Europe/London",
	"Europe/Paris",
	"Asia/Tokyo",
	"Asia/Singapore",
];

const getSupportedTimeZones = () => {
	if (typeof Intl === "undefined") {
		return null;
	}
	if (!("supportedValuesOf" in Intl)) {
		return null;
	}
	const supportedValuesOf = (
		Intl as typeof Intl & {
			supportedValuesOf: (key: "timeZone") => string[];
		}
	).supportedValuesOf;
	const values = supportedValuesOf("timeZone");
	return values.length > 0 ? values : null;
};

const isTimeZoneSupported = (value: string) => {
	try {
		Temporal.ZonedDateTime.from({
			timeZone: value,
			year: 1970,
			month: 1,
			day: 1,
			hour: 0,
			minute: 0,
			second: 0,
			millisecond: 0,
		});
		return true;
	} catch {
		return false;
	}
};

let cachedTimeZoneOptions: string[] | null = null;

export const getTimeZoneOptions = () => {
	if (cachedTimeZoneOptions) {
		return cachedTimeZoneOptions;
	}
	try {
		const supported = getSupportedTimeZones();
		const baseOptions = (supported ?? FALLBACK_TIME_ZONES).filter(isTimeZoneSupported);
		const options = !baseOptions.includes("UTC") && isTimeZoneSupported("UTC") ? [...baseOptions, "UTC"] : baseOptions;
		cachedTimeZoneOptions = options.length > 0 ? options : FALLBACK_TIME_ZONES;
		return cachedTimeZoneOptions;
	} catch {
		cachedTimeZoneOptions = FALLBACK_TIME_ZONES;
		return cachedTimeZoneOptions;
	}
};

export const isValidTimeZone = (value: string) => {
	if (!value || value.trim().length === 0) {
		return false;
	}
	const options = getTimeZoneOptions();
	return options.includes(value);
};

export const resolveTimeZone = (value?: string) => {
	const trimmed = value?.trim();
	const candidate = trimmed && trimmed.length > 0 ? trimmed : DEFAULT_TIME_ZONE;
	const options = [candidate, DEFAULT_TIME_ZONE, "UTC"];
	for (const option of options) {
		try {
			Temporal.ZonedDateTime.from({
				timeZone: option,
				year: 1970,
				month: 1,
				day: 1,
				hour: 0,
				minute: 0,
				second: 0,
				millisecond: 0,
			});
			return option;
		} catch {}
	}
	return DEFAULT_TIME_ZONE;
};

const toZonedDateTime = (date: Date, timeZone: string) => {
	const instant = Temporal.Instant.fromEpochMilliseconds(date.getTime());
	const resolvedTimeZone = resolveTimeZone(timeZone);
	const options = [resolvedTimeZone, DEFAULT_TIME_ZONE, "UTC"];
	for (const option of options) {
		try {
			return instant.toZonedDateTimeISO(option);
		} catch {}
	}
	return instant.toZonedDateTimeISO("UTC");
};

const toDate = (zonedDateTime: Temporal.ZonedDateTime) => {
	return new Date(zonedDateTime.toInstant().epochMilliseconds);
};

export const addDaysInTimeZone = (date: Date, days: number, timeZone: string) => {
	const zonedDateTime = toZonedDateTime(date, timeZone).add({ days });
	return toDate(zonedDateTime);
};

export const addMinutesInTimeZone = (date: Date, minutes: number, timeZone: string) => {
	const zonedDateTime = toZonedDateTime(date, timeZone).add({ minutes });
	return toDate(zonedDateTime);
};

export const addMonthsInTimeZone = (date: Date, months: number, timeZone: string) => {
	const zonedDateTime = toZonedDateTime(date, timeZone).add({ months });
	return toDate(zonedDateTime);
};

export const addYearsInTimeZone = (date: Date, years: number, timeZone: string) => {
	const zonedDateTime = toZonedDateTime(date, timeZone).add({ years });
	return toDate(zonedDateTime);
};

export const getStartOfDayInTimeZone = (date: Date, timeZone: string) => {
	const start = toZonedDateTime(date, timeZone).with({
		hour: 0,
		minute: 0,
		second: 0,
		millisecond: 0,
	});
	return toDate(start);
};

export const getMinutesSinceStartOfDayInTimeZone = (date: Date, timeZone: string) => {
	const zonedDateTime = toZonedDateTime(date, timeZone);
	return Math.floor(
		zonedDateTime.hour * 60 + zonedDateTime.minute + zonedDateTime.second / 60 + zonedDateTime.millisecond / 60000,
	);
};

export const getStartOfWeekInTimeZone = (date: Date, timeZone: string) => {
	const zonedDateTime = toZonedDateTime(date, timeZone);
	const diff = (zonedDateTime.dayOfWeek + 6) % 7;
	const start = zonedDateTime.subtract({ days: diff }).with({ hour: 0, minute: 0, second: 0, millisecond: 0 });
	return toDate(start);
};

export const getStartOfMonthInTimeZone = (date: Date, timeZone: string) => {
	const start = toZonedDateTime(date, timeZone).with({
		day: 1,
		hour: 0,
		minute: 0,
		second: 0,
		millisecond: 0,
	});
	return toDate(start);
};

export const getStartOfQuarterInTimeZone = (date: Date, timeZone: string) => {
	const zonedDateTime = toZonedDateTime(date, timeZone);
	const quarterStartMonth = Math.floor((zonedDateTime.month - 1) / 3) * 3 + 1;
	const start = zonedDateTime.with({
		month: quarterStartMonth,
		day: 1,
		hour: 0,
		minute: 0,
		second: 0,
		millisecond: 0,
	});
	return toDate(start);
};

export const getStartOfYearInTimeZone = (date: Date, timeZone: string) => {
	const start = toZonedDateTime(date, timeZone).with({
		month: 1,
		day: 1,
		hour: 0,
		minute: 0,
		second: 0,
		millisecond: 0,
	});
	return toDate(start);
};

export const getTimeZoneDayNumber = (date: Date, timeZone: string) => {
	const zonedDateTime = toZonedDateTime(date, timeZone);
	return Math.floor(Date.UTC(zonedDateTime.year, zonedDateTime.month - 1, zonedDateTime.day) / 86_400_000);
};
