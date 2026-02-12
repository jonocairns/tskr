import type { DurationKey } from "@/lib/points";
import { normalizePresetIconKey, type PresetIconKey } from "@/lib/presetIcons";

type PresetRecord = {
	id: string;
	label: string;
	bucket: string;
	templateKey: string | null;
	iconKey: string | null;
	isShared: boolean;
	sortOrder: number;
	createdById: string;
	approvalOverride: string | null;
	createdAt: Date;
};

export type PresetSummary = {
	id: string;
	label: string;
	bucket: DurationKey;
	templateKey: string | null;
	iconKey: PresetIconKey | null;
	isShared: boolean;
	sortOrder: number;
	createdById: string;
	approvalOverride: "REQUIRE" | "SKIP" | null;
	createdAt: string;
};

export function mapPresetSummaries(presets: PresetRecord[]): PresetSummary[] {
	return presets.map((preset) => ({
		...preset,
		bucket: preset.bucket as DurationKey,
		iconKey: normalizePresetIconKey(preset.iconKey),
		approvalOverride:
			preset.approvalOverride === "REQUIRE" || preset.approvalOverride === "SKIP" ? preset.approvalOverride : null,
		createdAt: preset.createdAt.toISOString(),
	}));
}
