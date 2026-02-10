"use client";

import { Loader2Icon } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import { BUCKET_WINDOW_SHORT } from "@/components/task-actions/utils";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Label } from "@/components/ui/Label";
import { useTranslation } from "@/lib/i18nClient";
import type { DurationKey } from "@/lib/points";
import { getLocalizedDurationBuckets } from "@/lib/points";
import { cn } from "@/lib/utils";

type OneOffTaskModalProps = {
	open: boolean;
	onClose: () => void;
	defaultBucket: DurationKey;
	disabled: boolean;
	isPending: boolean;
	onSubmit: (label: string, bucket: DurationKey) => Promise<boolean>;
};

export const OneOffTaskModal = ({
	open,
	onClose,
	defaultBucket,
	disabled,
	isPending,
	onSubmit,
}: OneOffTaskModalProps) => {
	const { t } = useTranslation();
	const localizedBuckets = useMemo(() => getLocalizedDurationBuckets(t), [t]);
	const [taskLabel, setTaskLabel] = useState("");
	const [taskBucket, setTaskBucket] = useState<DurationKey>(defaultBucket);
	const [isMounted, setIsMounted] = useState(false);

	useEffect(() => {
		if (!open) {
			setTaskLabel("");
			setTaskBucket(defaultBucket);
		}
	}, [open, defaultBucket]);

	useEffect(() => {
		setIsMounted(true);
	}, []);

	if (!open || !isMounted) {
		return null;
	}

	const canSubmit = taskLabel.trim().length >= 2;

	const handleSubmit = async (): Promise<void> => {
		if (!canSubmit) {
			return;
		}
		const success = await onSubmit(taskLabel, taskBucket);
		if (success) {
			onClose();
		}
	};

	return createPortal(
		<div className="fixed inset-0 z-50">
			<button
				type="button"
				className="absolute inset-0 bg-background/80 backdrop-blur-sm"
				onClick={onClose}
				aria-label={t("Close")}
			/>
			<div
				role="dialog"
				aria-modal="true"
				aria-label={t("Log one off task")}
				className="absolute left-1/2 top-1/2 w-[calc(100%-2rem)] max-w-md -translate-x-1/2 -translate-y-1/2 rounded-xl border bg-background shadow-xl"
			>
				<div className="flex items-center justify-between gap-2 border-b px-4 py-4">
					<p className="text-sm font-semibold">{t("Log one off task")}</p>
					<Button type="button" variant="ghost" size="sm" onClick={onClose}>
						{t("Close")}
					</Button>
				</div>
				<div className="max-h-[80vh] space-y-4 overflow-y-auto p-4">
					<div className="space-y-2">
						<Label htmlFor="one-off-task-name" className="text-xs text-muted-foreground">
							{t("Task name")}
						</Label>
						<Input
							id="one-off-task-name"
							placeholder={t("Name your task")}
							value={taskLabel}
							onChange={(event) => setTaskLabel(event.target.value)}
							disabled={disabled}
						/>
					</div>
					<div className="space-y-2">
						<p className="text-xs font-medium text-muted-foreground">{t("Bucket")}</p>
						<div className="grid grid-cols-2 gap-2 sm:grid-cols-3" role="radiogroup" aria-label={t("Bucket")}>
							{localizedBuckets.map((bucket) => {
								const isSelected = taskBucket === bucket.key;
								return (
									<label
										key={bucket.key}
										className={cn(
											"flex w-full flex-col items-start rounded-lg border p-3 text-left transition",
											isSelected && "border-primary bg-primary/5",
											disabled ? "pointer-events-none opacity-50" : "hover:border-primary",
										)}
									>
										<input
											type="radio"
											name="one-off-bucket"
											value={bucket.key}
											checked={isSelected}
											onChange={() => setTaskBucket(bucket.key)}
											className="sr-only"
											disabled={disabled}
										/>
										<span className="text-sm font-semibold">{bucket.label}</span>
										<span className="text-xs text-muted-foreground">
											{t("{{points}} pts · {{window}}", {
												points: bucket.points,
												window: BUCKET_WINDOW_SHORT[bucket.key],
											})}
										</span>
									</label>
								);
							})}
						</div>
					</div>
					<div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
						<Button type="button" variant="outline" onClick={onClose} disabled={disabled}>
							{t("Cancel")}
						</Button>
						<Button type="button" onClick={handleSubmit} disabled={disabled || !canSubmit}>
							{isPending ? <Loader2Icon className="mr-2 h-4 w-4 animate-spin" /> : null}
							{t("Log one off task")}
						</Button>
					</div>
				</div>
			</div>
		</div>,
		document.body,
	);
};
