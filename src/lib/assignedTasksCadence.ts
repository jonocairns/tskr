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

const CADENCE_LABELS: Record<number, string> = Object.fromEntries(
	CADENCE_INTERVALS.map((option) => [option.minutes, option.label]),
);

export const formatCadenceInterval = (minutes: number) => {
	const label = CADENCE_LABELS[minutes];
	if (label) {
		return label;
	}
	if (minutes % 60 === 0) {
		const hours = Math.round(minutes / 60);
		return `Every ${hours}h`;
	}
	return `Every ${minutes}m`;
};
