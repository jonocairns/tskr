import { getStartOfDayInTimeZone, getTimeZoneDayNumber, resolveTimeZone } from "@/lib/timeZones";

const DATE_LOCALE = "en-US";

export const DATE_FORMATS = ["DMY", "MDY", "YMD"] as const;
export type DateFormat = (typeof DATE_FORMATS)[number];

export const TIME_FORMATS = ["H24", "H12"] as const;
export type TimeFormat = (typeof TIME_FORMATS)[number];

export const DEFAULT_DATE_FORMAT: DateFormat = "DMY";
export const DEFAULT_TIME_FORMAT: TimeFormat = "H24";

type DateFormatOptions = {
	dateFormat?: DateFormat;
	timeZone?: string;
};

type ReadableDateOptions = {
	dateFormat?: DateFormat;
	includeYear?: boolean;
	timeZone?: string;
};

type DateTimeFormatOptions = DateFormatOptions & {
	timeFormat?: TimeFormat;
};

const dateFormatterCache = new Map<string, Intl.DateTimeFormat>();
const readableDateFormatterCache = new Map<string, Intl.DateTimeFormat>();
const timeFormatterCache = new Map<string, Intl.DateTimeFormat>();

const getDateFormatter = (timeZone?: string) => {
	const cacheKey = `date:${timeZone ?? "local"}`;
	const cached = dateFormatterCache.get(cacheKey);
	if (cached) {
		return cached;
	}
	const options: Intl.DateTimeFormatOptions = {
		year: "numeric",
		month: "2-digit",
		day: "2-digit",
		...(timeZone ? { timeZone } : {}),
	};
	const formatter = new Intl.DateTimeFormat(DATE_LOCALE, options);
	dateFormatterCache.set(cacheKey, formatter);
	return formatter;
};

const getTimeFormatter = (timeZone: string | undefined, hour12: boolean) => {
	const cacheKey = `time:${timeZone ?? "local"}:${hour12 ? "12" : "24"}`;
	const cached = timeFormatterCache.get(cacheKey);
	if (cached) {
		return cached;
	}
	const options: Intl.DateTimeFormatOptions = {
		hour: hour12 ? "numeric" : "2-digit",
		minute: "2-digit",
		hour12,
		...(timeZone ? { timeZone } : {}),
	};
	const formatter = new Intl.DateTimeFormat(DATE_LOCALE, options);
	timeFormatterCache.set(cacheKey, formatter);
	return formatter;
};

const getReadableDateFormatter = ({ includeYear = false, timeZone }: { includeYear?: boolean; timeZone?: string }) => {
	const cacheKey = `readable-date:${timeZone ?? "local"}:${includeYear ? "with-year" : "no-year"}`;
	const cached = readableDateFormatterCache.get(cacheKey);
	if (cached) {
		return cached;
	}
	const options: Intl.DateTimeFormatOptions = {
		weekday: "short",
		day: "numeric",
		month: "short",
		...(includeYear ? { year: "numeric" } : {}),
		...(timeZone ? { timeZone } : {}),
	};
	const formatter = new Intl.DateTimeFormat(DATE_LOCALE, options);
	readableDateFormatterCache.set(cacheKey, formatter);
	return formatter;
};

const toDate = (value: string | Date) => (value instanceof Date ? value : new Date(value));

const normalizeDateOptions = (options?: DateFormatOptions | string): DateFormatOptions => {
	if (typeof options === "string") {
		return { timeZone: options };
	}
	return options ?? {};
};

const normalizeReadableDateOptions = (options?: ReadableDateOptions | string): ReadableDateOptions => {
	if (typeof options === "string") {
		return { timeZone: options };
	}
	return options ?? {};
};

const normalizeDateTimeOptions = (options?: DateTimeFormatOptions | string): DateTimeFormatOptions => {
	if (typeof options === "string") {
		return { timeZone: options };
	}
	return options ?? {};
};

const getDateParts = (value: string | Date, timeZone?: string) => {
	const date = toDate(value);
	const parts = getDateFormatter(timeZone).formatToParts(date);
	const partMap = new Map(parts.map((part) => [part.type, part.value]));
	return {
		year: partMap.get("year") ?? "",
		month: partMap.get("month") ?? "",
		day: partMap.get("day") ?? "",
	};
};

export const formatTime = (value: string | Date, timeFormat: TimeFormat, timeZone?: string) => {
	const date = toDate(value);
	const use12Hour = timeFormat === "H12";
	const parts = getTimeFormatter(timeZone, use12Hour).formatToParts(date);
	const partMap = new Map(parts.map((part) => [part.type, part.value]));
	const hour = partMap.get("hour") ?? "";
	const minute = partMap.get("minute") ?? "";
	if (use12Hour) {
		const dayPeriod = partMap.get("dayPeriod");
		return dayPeriod ? `${hour}:${minute} ${dayPeriod}` : `${hour}:${minute}`;
	}
	return `${hour}:${minute}`;
};

export const formatDate = (value: string | Date, options?: DateFormatOptions | string) => {
	const { dateFormat = DEFAULT_DATE_FORMAT, timeZone } = normalizeDateOptions(options);
	const { year, month, day } = getDateParts(value, timeZone);

	switch (dateFormat) {
		case "YMD":
			return `${year}-${month}-${day}`;
		case "MDY":
			return `${month}/${day}/${year}`;
		default:
			return `${day}/${month}/${year}`;
	}
};

export const formatReadableDate = (value: string | Date, options?: ReadableDateOptions | string) => {
	const { dateFormat, includeYear = false, timeZone } = normalizeReadableDateOptions(options);
	// YMD households read dates numerically, so keep their format rather than spelling the month out.
	if (dateFormat === "YMD") return formatDate(value, { dateFormat, timeZone });
	const parts = getReadableDateFormatter({ includeYear, timeZone }).formatToParts(toDate(value));
	const partMap = new Map(parts.map((part) => [part.type, part.value]));
	const weekday = partMap.get("weekday") ?? "";
	const day = partMap.get("day") ?? "";
	const month = partMap.get("month") ?? "";
	const year = partMap.get("year") ?? "";
	if (dateFormat === "MDY") return includeYear ? `${weekday}, ${month} ${day}, ${year}` : `${weekday}, ${month} ${day}`;
	return includeYear ? `${weekday} ${day} ${month} ${year}` : `${weekday} ${day} ${month}`;
};

export const formatDateTime = (value: string | Date, options?: DateTimeFormatOptions | string) => {
	const {
		dateFormat = DEFAULT_DATE_FORMAT,
		timeFormat = DEFAULT_TIME_FORMAT,
		timeZone,
	} = normalizeDateTimeOptions(options);
	const date = formatDate(value, { dateFormat, timeZone });
	const time = formatTime(value, timeFormat, timeZone);
	return `${date} ${time}`;
};

type Translate = (key: string, options?: Record<string, unknown>) => string;

type RelativeWhenOptions = {
	t: Translate;
	timeZone: string;
	dateFormat: DateFormat;
	timeFormat: TimeFormat;
	now?: Date;
};

const weekdayFormatterCache = new Map<string, Intl.DateTimeFormat>();

const formatWeekday = (date: Date, timeZone: string) => {
	const cached = weekdayFormatterCache.get(timeZone);
	const formatter = cached ?? new Intl.DateTimeFormat(DATE_LOCALE, { weekday: "long", timeZone });
	if (!cached) weekdayFormatterCache.set(timeZone, formatter);
	return formatter.format(date);
};

const keepTogether = (value: string) => value.replaceAll(" ", "\u00a0");

// Phrases a future instant relative to now in the household time zone ("tomorrow", "on Monday",
// "today at 14:01"). Calendar boundaries fall at midnight, where the time adds nothing, so those read as
// a day alone. `hasTime` tells callers when a time-zone hint might help.
export const formatRelativeWhen = (
	value: string | Date,
	{ t, timeZone, dateFormat, timeFormat, now = new Date() }: RelativeWhenOptions,
) => {
	const date = toDate(value);
	const zone = resolveTimeZone(timeZone);
	const dayDiff = getTimeZoneDayNumber(date, zone) - getTimeZoneDayNumber(now, zone);
	const hasTime = getStartOfDayInTimeZone(date, zone).getTime() !== date.getTime();
	const includeYear = getDateParts(date, zone).year !== getDateParts(now, zone).year;
	const day =
		dayDiff === 0
			? t("today")
			: dayDiff === 1
				? t("tomorrow")
				: dayDiff > 1 && dayDiff < 7
					? t("on {{day}}", { day: formatWeekday(date, zone) })
					: t("on {{day}}", {
							day: keepTogether(formatReadableDate(date, { timeZone: zone, dateFormat, includeYear })),
						});
	const text = hasTime
		? t("{{when}} at {{time}}", { when: day, time: keepTogether(formatTime(date, timeFormat, zone)) })
		: day;
	return { text, hasTime };
};
