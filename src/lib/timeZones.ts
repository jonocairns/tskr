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

const isTimeZoneSupported = (value: string) => {
	if (typeof Intl === "undefined") {
		return true;
	}
	try {
		new Intl.DateTimeFormat("en-US", { timeZone: value }).format(0);
		return true;
	} catch {
		return false;
	}
};

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

export const getTimeZoneOptions = () => {
	const supported = getSupportedTimeZones();
	if (supported) {
		return supported;
	}
	return FALLBACK_TIME_ZONES.filter(isTimeZoneSupported);
};

export const isValidTimeZone = (value: string) => {
	if (!value || value.trim().length === 0) {
		return false;
	}
	const options = getTimeZoneOptions();
	return options.includes(value);
};
