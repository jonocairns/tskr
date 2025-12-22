export const DURATION_KEYS = [
  "TINY",
  "QUICK",
  "ROUTINE",
  "CHALLENGING",
  "HEAVY",
  "MAJOR",
] as const;

export type DurationKey = (typeof DURATION_KEYS)[number];

export const BUCKET_POINTS: Record<DurationKey, number> = {
  TINY: 1,
  QUICK: 3,
  ROUTINE: 6,
  CHALLENGING: 10,
  HEAVY: 15,
  MAJOR: 21,
};

export const DURATION_BUCKETS: Array<{
  key: DurationKey;
  label: string;
  window: string;
  points: number;
}> = [
  { key: "TINY", label: "Tiny", window: "< 1 min", points: BUCKET_POINTS.TINY },
  { key: "QUICK", label: "Quick", window: "1–5 min", points: BUCKET_POINTS.QUICK },
  { key: "ROUTINE", label: "Routine", window: "5–15 min", points: BUCKET_POINTS.ROUTINE },
  {
    key: "CHALLENGING",
    label: "Challenging",
    window: "15–30 min",
    points: BUCKET_POINTS.CHALLENGING,
  },
  { key: "HEAVY", label: "Heavy", window: "30–60 min", points: BUCKET_POINTS.HEAVY },
  { key: "MAJOR", label: "Major", window: "1–2 hours", points: BUCKET_POINTS.MAJOR },
];

export const PRESET_TASKS: Array<{
  key: string;
  label: string;
  bucket: DurationKey;
}> = [
  { key: "bins", label: "Bins", bucket: "QUICK" },
  { key: "toilet", label: "Toilet", bucket: "ROUTINE" },
  { key: "kitchen", label: "Kitchen", bucket: "QUICK" },
  { key: "folding", label: "Folding", bucket: "ROUTINE" },
  { key: "bed-made", label: "Bed made", bucket: "QUICK" },
  { key: "lawns", label: "Lawns", bucket: "HEAVY" },
  { key: "vanities", label: "Vanities", bucket: "QUICK" },
  { key: "vacuum", label: "Vacuum", bucket: "CHALLENGING" },
];

export function findPreset(key: string) {
  return PRESET_TASKS.find((task) => task.key === key);
}

export function getBucketPoints(bucket: DurationKey) {
  return BUCKET_POINTS[bucket];
}

export const LOG_KINDS = ["PRESET", "TIMED", "REWARD"] as const;
export type LogKind = (typeof LOG_KINDS)[number];

export function rewardThreshold() {
  const fallback = 50;
  const parsed = Number(process.env.REWARD_THRESHOLD_POINTS ?? fallback);
  if (Number.isFinite(parsed) && parsed > 0) {
    return Math.floor(parsed);
  }
  return fallback;
}
