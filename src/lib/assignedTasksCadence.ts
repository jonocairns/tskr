export const CADENCE_NONE_VALUE = "none";

const CADENCE_INTERVALS = [
	{ minutes: 1440, label: "Daily" },
	{ minutes: 10080, label: "Weekly" },
	{ minutes: 20160, label: "Fortnightly" },
	{ minutes: 43200, label: "Monthly" },
	{ minutes: 129600, label: "Quarterly" },
	{ minutes: 525600, label: "Yearly" },
];

export const DEFAULT_CADENCE_INTERVAL_MINUTES = 10080;
export const DEFAULT_CADENCE_TARGET = 1;

export const CADENCE_OPTIONS = [
	{ value: CADENCE_NONE_VALUE, label: "None" },
	...CADENCE_INTERVALS.map((option) => ({
		value: String(option.minutes),
		label: option.label,
	})),
];

type Translate = (key: string, options?: Record<string, unknown>) => string;

// Shared by the dashboard queue and the week view so both show the same translated labels.
export const formatCadenceInterval = (minutes: number, t: Translate) => {
	switch (minutes) {
		case 1440:
			return t("Daily");
		case 10080:
			return t("Weekly");
		case 20160:
			return t("Fortnightly");
		case 43200:
			return t("Monthly");
		case 129600:
			return t("Quarterly");
		case 525600:
			return t("Yearly");
		default:
			return minutes % 60 === 0
				? t("Every {{count}}h", { count: minutes / 60 })
				: t("Every {{count}}m", { count: minutes });
	}
};

export const getBucketLabels = (t: Translate) => ({
	TINY: t("Tiny"),
	QUICK: t("Quick"),
	ROUTINE: t("Routine"),
	CHALLENGING: t("Challenging"),
	HEAVY: t("Heavy"),
	MAJOR: t("Major"),
});
