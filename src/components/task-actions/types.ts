import type { DurationKey } from "@/lib/points";
import type { PresetIconKey } from "@/lib/presetIcons";

export type { PresetSummary } from "@/lib/dashboard/presets";

export type PresetOption = {
	id: string;
	label: string;
	bucket: DurationKey;
	templateKey: string | null;
	iconKey: PresetIconKey | null;
	isShared: boolean;
	sortOrder: number;
};

export type PresetTemplate = {
	key: string;
	label: string;
	bucket: DurationKey;
};
