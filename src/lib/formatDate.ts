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

type DateTimeFormatOptions = DateFormatOptions & {
	timeFormat?: TimeFormat;
};

const dateFormatterCache = new Map<string, Intl.DateTimeFormat>();
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

const toDate = (value: string | Date) => (value instanceof Date ? value : new Date(value));

const normalizeDateOptions = (options?: DateFormatOptions | string): DateFormatOptions => {
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

const formatTime = (value: string | Date, timeFormat: TimeFormat, timeZone?: string) => {
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
		case "DMY":
		default:
			return `${day}/${month}/${year}`;
	}
};

export const formatDateTime = (value: string | Date, options?: DateTimeFormatOptions | string) => {
	const { dateFormat = DEFAULT_DATE_FORMAT, timeFormat = DEFAULT_TIME_FORMAT, timeZone } =
		normalizeDateTimeOptions(options);
	const date = formatDate(value, { dateFormat, timeZone });
	const time = formatTime(value, timeFormat, timeZone);
	return `${date} ${time}`;
};
