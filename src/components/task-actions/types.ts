import type { DurationKey } from "@/lib/points";

export type { PresetSummary } from "@/lib/dashboard/presets";

export type PresetOption = {
	id: string;
	label: string;
	bucket: DurationKey;
	isShared: boolean;
};

export type PresetTemplate = {
	key: string;
	label: string;
	bucket: DurationKey;
};
