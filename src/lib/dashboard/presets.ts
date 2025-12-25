import type { DurationKey } from "@/lib/points";

type PresetRecord = {
	id: string;
	label: string;
	bucket: string;
	isShared: boolean;
	createdById: string;
	createdAt: Date;
};

export type PresetSummary = {
	id: string;
	label: string;
	bucket: DurationKey;
	isShared: boolean;
	createdById: string;
	createdAt: string;
};

export function mapPresetSummaries(presets: PresetRecord[]): PresetSummary[] {
	return presets.map((preset) => ({
		...preset,
		bucket: preset.bucket as DurationKey,
		createdAt: preset.createdAt.toISOString(),
	}));
}
