export const DURATION_KEYS = ["TINY", "QUICK", "ROUTINE", "CHALLENGING", "HEAVY", "MAJOR"] as const;

export type DurationKey = (typeof DURATION_KEYS)[number];
type Translator = (value: string) => string;

export const BUCKET_POINTS: Record<DurationKey, number> = {
	TINY: 1,
	QUICK: 3,
	ROUTINE: 6,
	CHALLENGING: 10,
	HEAVY: 15,
	MAJOR: 21,
};

type DurationBucket = {
	key: DurationKey;
	label: string;
	window: string;
	points: number;
};

type PresetTask = {
	key: string;
	label: string;
	bucket: DurationKey;
};

const identityTranslate = (value: string) => value;

export const getDurationBuckets = (t: Translator = identityTranslate): DurationBucket[] => [
	{ key: "TINY", label: t("Tiny"), window: t("< 1 min"), points: BUCKET_POINTS.TINY },
	{
		key: "QUICK",
		label: t("Quick"),
		window: t("1–5 min"),
		points: BUCKET_POINTS.QUICK,
	},
	{
		key: "ROUTINE",
		label: t("Routine"),
		window: t("5–15 min"),
		points: BUCKET_POINTS.ROUTINE,
	},
	{
		key: "CHALLENGING",
		label: t("Challenging"),
		window: t("15–30 min"),
		points: BUCKET_POINTS.CHALLENGING,
	},
	{
		key: "HEAVY",
		label: t("Heavy"),
		window: t("30–60 min"),
		points: BUCKET_POINTS.HEAVY,
	},
	{
		key: "MAJOR",
		label: t("Major"),
		window: t("1–2 hours"),
		points: BUCKET_POINTS.MAJOR,
	},
];

export const DURATION_BUCKETS: DurationBucket[] = getDurationBuckets();

export const getPresetTasks = (t: Translator = identityTranslate): PresetTask[] => [
	{ key: "bins", label: t("Bins"), bucket: "QUICK" },
	{ key: "toilet", label: t("Toilet"), bucket: "ROUTINE" },
	{ key: "kitchen", label: t("Kitchen"), bucket: "QUICK" },
	{ key: "cook", label: t("Cook"), bucket: "HEAVY" },
	{ key: "dinner-dishes", label: t("Dinner Dishes"), bucket: "ROUTINE" },
	{ key: "folding", label: t("Folding"), bucket: "ROUTINE" },
	{ key: "bed-made", label: t("Bed sheets"), bucket: "QUICK" },
	{ key: "lawns", label: t("Lawns"), bucket: "HEAVY" },
	{ key: "vanities", label: t("Vanities"), bucket: "QUICK" },
	{ key: "vacuum", label: t("Vacuum"), bucket: "CHALLENGING" },
	{ key: "laundry", label: t("Laundry"), bucket: "QUICK" },
	{ key: "dishwasher", label: t("Dishwasher"), bucket: "QUICK" },
];

export const PRESET_TASKS: PresetTask[] = getPresetTasks();

export function findPreset(key: string) {
	return PRESET_TASKS.find((task) => task.key === key);
}

export function getBucketPoints(bucket: DurationKey) {
	return BUCKET_POINTS[bucket];
}

export const LOG_KINDS = ["PRESET", "TIMED", "REWARD"] as const;
export type LogKind = (typeof LOG_KINDS)[number];
