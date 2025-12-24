import type { DurationKey } from "@/lib/points";
export type { PresetSummary } from "@/lib/dashboard/presets";

export type PresetOption = {
	kind: "builtin" | "custom";
	id: string;
	label: string;
	bucket: DurationKey;
	isShared: boolean;
};
