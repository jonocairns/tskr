import type { PresetSummary } from "@/components/task-actions/types";
import type { DurationKey } from "@/lib/points";

export const BUCKET_WINDOW_SHORT: Record<DurationKey, string> = {
	TINY: "<1m",
	QUICK: "1-5m",
	ROUTINE: "5-15m",
	CHALLENGING: "15-30m",
	HEAVY: "30-60m",
	MAJOR: "60-120m",
};

export const normalizeText = (value: string) => value.trim().toLowerCase();

export const sortEditablePresets = (presets: PresetSummary[], currentUserId: string) => {
	return [...presets.filter((preset) => preset.isShared || preset.createdById === currentUserId)].sort((a, b) => {
		if (a.sortOrder !== b.sortOrder) {
			return a.sortOrder - b.sortOrder;
		}
		return new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime();
	});
};
