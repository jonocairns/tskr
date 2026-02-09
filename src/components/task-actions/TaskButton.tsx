import { useMemo } from "react";

import { PresetIconGlyph } from "@/components/task-actions/presetIcons";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { useTranslation } from "@/lib/i18nClient";
import { type DurationKey, getLocalizedDurationBuckets } from "@/lib/points";
import type { PresetIconKey } from "@/lib/presetIcons";

type TaskButtonProps = {
	id: string;
	label: string;
	bucket: DurationKey;
	iconKey: PresetIconKey | null;
	disabled?: boolean;
	onClick: (taskId: string) => void;
};

export const TaskButton = ({ id, label, bucket, iconKey, disabled, onClick }: TaskButtonProps) => {
	const { t } = useTranslation();
	const durationBuckets = useMemo(() => getLocalizedDurationBuckets(t), [t]);
	const bucketInfo = durationBuckets.find((b) => b.key === bucket);

	return (
		<Button
			variant="outline"
			className="flex h-auto flex-col items-start gap-1 py-3"
			onClick={() => onClick(id)}
			disabled={disabled}
		>
			<div className="flex w-full items-center justify-between gap-2">
				<div className="flex items-center gap-2">
					<PresetIconGlyph iconKey={iconKey} className="h-4 w-4 text-muted-foreground" />
					<span className="font-semibold">{label}</span>
				</div>
				<div className="flex items-center gap-1">
					<Badge variant="secondary">{bucketInfo?.label}</Badge>
				</div>
			</div>
			<span className="text-xs text-muted-foreground">
				{t("{{points}} pts · {{window}}", { points: bucketInfo?.points ?? 0, window: bucketInfo?.window ?? "" })}
			</span>
		</Button>
	);
};
