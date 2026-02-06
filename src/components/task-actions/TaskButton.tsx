import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { useTranslation } from "@/lib/i18nClient";
import { DURATION_BUCKETS, type DurationKey } from "@/lib/points";

type TaskButtonProps = {
	id: string;
	label: string;
	bucket: DurationKey;
	disabled?: boolean;
	onClick: (taskId: string) => void;
};

export const TaskButton = ({ id, label, bucket, disabled, onClick }: TaskButtonProps) => {
	const { t } = useTranslation();
	const bucketInfo = DURATION_BUCKETS.find((b) => b.key === bucket);

	return (
		<Button
			variant="outline"
			className="flex h-auto flex-col items-start gap-1 py-3"
			onClick={() => onClick(id)}
			disabled={disabled}
		>
			<div className="flex w-full items-center justify-between gap-2">
				<span className="font-semibold">{label}</span>
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
