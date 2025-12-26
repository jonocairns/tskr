import type { DurationKey } from "@/lib/points";

type PresetRecord = {
	id: string;
	label: string;
	bucket: string;
	isShared: boolean;
	createdById: string;
	approvalOverride: string | null;
	createdAt: Date;
};

export type PresetSummary = {
	id: string;
	label: string;
	bucket: DurationKey;
	isShared: boolean;
	createdById: string;
	approvalOverride: "REQUIRE" | "SKIP" | null;
	createdAt: string;
};

export function mapPresetSummaries(presets: PresetRecord[]): PresetSummary[] {
	return presets.map((preset) => ({
		...preset,
		bucket: preset.bucket as DurationKey,
		approvalOverride:
			preset.approvalOverride === "REQUIRE" ||
			preset.approvalOverride === "SKIP"
				? preset.approvalOverride
				: null,
		createdAt: preset.createdAt.toISOString(),
	}));
}
