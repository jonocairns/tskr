const DATE_LOCALE = "en-GB";

const formatOptions = {
	date: {
		year: "numeric",
		month: "2-digit",
		day: "2-digit",
	},
	time: {
		hour: "2-digit",
		minute: "2-digit",
		hour12: false,
	},
} as const;

const formatterCache = new Map<string, Intl.DateTimeFormat>();

const getFormatter = (key: keyof typeof formatOptions, timeZone?: string) => {
	const cacheKey = `${key}:${timeZone ?? "local"}`;
	const cached = formatterCache.get(cacheKey);
	if (cached) {
		return cached;
	}
	const options = timeZone ? { ...formatOptions[key], timeZone } : formatOptions[key];
	const formatter = new Intl.DateTimeFormat(DATE_LOCALE, options);
	formatterCache.set(cacheKey, formatter);
	return formatter;
};

const toDate = (value: string | Date) => {
	return value instanceof Date ? value : new Date(value);
};

export const formatDate = (value: string | Date, timeZone?: string) => {
	return getFormatter("date", timeZone).format(toDate(value));
};

export const formatDateTime = (value: string | Date, timeZone?: string) => {
	const date = formatDate(value, timeZone);
	const time = getFormatter("time", timeZone).format(toDate(value));
	return `${date} ${time}`;
};
