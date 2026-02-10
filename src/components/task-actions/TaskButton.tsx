import { PencilIcon, Trash2Icon } from "lucide-react";
import type { KeyboardEvent } from "react";
import { useMemo } from "react";

import { PresetIconGlyph } from "@/components/task-actions/presetIcons";
import {
	AlertDialog,
	AlertDialogAction,
	AlertDialogCancel,
	AlertDialogContent,
	AlertDialogDescription,
	AlertDialogFooter,
	AlertDialogHeader,
	AlertDialogTitle,
	AlertDialogTrigger,
} from "@/components/ui/AlertDialog";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { useTranslation } from "@/lib/i18nClient";
import { type DurationKey, getLocalizedDurationBuckets } from "@/lib/points";
import type { PresetIconKey } from "@/lib/presetIcons";
import { cn } from "@/lib/utils";

type TaskButtonProps = {
	id: string;
	label: string;
	bucket: DurationKey;
	iconKey: PresetIconKey | null;
	disabled?: boolean;
	onClick: (taskId: string) => void;
	isEditMode?: boolean;
	onEdit?: (taskId: string) => void;
	onDelete?: (taskId: string) => void;
	canDelete?: boolean;
};

export const TaskButton = ({
	id,
	label,
	bucket,
	iconKey,
	disabled,
	onClick,
	isEditMode = false,
	onEdit,
	onDelete,
	canDelete = false,
}: TaskButtonProps) => {
	const { t } = useTranslation();
	const durationBuckets = useMemo(() => getLocalizedDurationBuckets(t), [t]);
	const bucketInfo = durationBuckets.find((b) => b.key === bucket);
	const isTileInteractive = !isEditMode;
	const metaText = t("{{points}} pts · {{window}}", {
		points: bucketInfo?.points ?? 0,
		window: bucketInfo?.window ?? "",
	});
	const rootClassName =
		"group flex min-h-20 w-full flex-col items-start justify-start gap-1 rounded-xl border border-border/70 bg-background/60 px-3 py-3 text-left shadow-sm transition hover:border-primary/60 hover:bg-accent/30 hover:shadow-md";
	const handleTileActivate = () => {
		if (!isTileInteractive || disabled) {
			return;
		}

		onClick(id);
	};
	const handleTileKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
		if (!isTileInteractive || disabled) {
			return;
		}
		if (event.key === "Enter" || event.key === " ") {
			event.preventDefault();
			onClick(id);
		}
	};
	const interactiveProps = isTileInteractive
		? {
				role: "button" as const,
				tabIndex: disabled ? -1 : 0,
				"aria-disabled": disabled,
				onClick: handleTileActivate,
				onKeyDown: handleTileKeyDown,
			}
		: {};
	const tileBody = (
		<div className="flex w-full items-start gap-2">
			<div className="min-w-0 flex-1 space-y-1">
				<div className="flex items-center gap-2 overflow-hidden">
					<div className="rounded-md bg-muted/60 p-1.5 transition-colors group-hover:bg-muted">
						<PresetIconGlyph iconKey={iconKey} className="h-4 w-4 text-muted-foreground" />
					</div>
					<span className="truncate font-semibold">{label}</span>
				</div>
				<span className="block text-xs font-medium leading-tight text-muted-foreground">{metaText}</span>
			</div>
			<div className="flex w-[4.5rem] shrink-0 items-start justify-end">
				{isEditMode ? (
					<div className="flex w-full items-center justify-end gap-1">
						<Button
							type="button"
							variant="ghost"
							size="icon"
							onClick={() => onEdit?.(id)}
							disabled={disabled}
							aria-label={t("Edit task")}
							className="h-8 w-8"
						>
							<PencilIcon className="h-4 w-4" />
						</Button>
						{canDelete ? (
							<AlertDialog>
								<AlertDialogTrigger asChild>
									<Button
										type="button"
										variant="ghost"
										size="icon"
										disabled={disabled}
										aria-label={t("Delete task")}
										className="h-8 w-8"
									>
										<Trash2Icon className="h-4 w-4 text-destructive" />
									</Button>
								</AlertDialogTrigger>
								<AlertDialogContent>
									<AlertDialogHeader>
										<AlertDialogTitle>{t("Delete task preset?")}</AlertDialogTitle>
										<AlertDialogDescription>
											{t('This will delete "{{label}}" and cannot be undone.', { label })}
										</AlertDialogDescription>
									</AlertDialogHeader>
									<AlertDialogFooter>
										<AlertDialogCancel>{t("Cancel")}</AlertDialogCancel>
										<AlertDialogAction
											type="button"
											onClick={() => onDelete?.(id)}
											className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
										>
											{t("Delete")}
										</AlertDialogAction>
									</AlertDialogFooter>
								</AlertDialogContent>
							</AlertDialog>
						) : null}
					</div>
				) : (
					<div className="flex w-full items-center justify-end gap-1">
						<Badge variant="secondary" className="font-semibold">
							{bucketInfo?.label}
						</Badge>
					</div>
				)}
			</div>
		</div>
	);

	return (
		<div
			{...interactiveProps}
			className={cn(
				rootClassName,
				isTileInteractive ? "cursor-pointer hover:-translate-y-0.5 text-sm font-medium" : "text-sm",
				disabled ? "opacity-50" : null,
			)}
		>
			{tileBody}
		</div>
	);
};
