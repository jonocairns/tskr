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
	const [isSubmitPending, setIsSubmitPending] = useState(false);

	useEffect(() => {
		if (!open) {
			setTaskLabel("");
			setTaskBucket(defaultBucket);
			setIsSubmitPending(false);
		}
	}, [open, defaultBucket]);

	useEffect(() => {
		setIsMounted(true);
	}, []);

	if (!open || !isMounted) {
		return null;
	}

	const canSubmit = taskLabel.trim().length >= 2;
	const modalDisabled = disabled || isSubmitPending;
	const submitPending = isPending || isSubmitPending;

	const handleSubmit = async (): Promise<void> => {
		if (!canSubmit || isSubmitPending) {
			return;
		}

		setIsSubmitPending(true);
		try {
			const success = await onSubmit(taskLabel, taskBucket);
			if (success) {
				onClose();
			}
		} finally {
			setIsSubmitPending(false);
		}
	};

	return createPortal(
		<div className="fixed inset-0 z-50">
			<button
				type="button"
				className="absolute inset-0 bg-background/80 backdrop-blur-sm"
				onClick={onClose}
				aria-label={t("Close")}
				disabled={isSubmitPending}
			/>
			<div
				role="dialog"
				aria-modal="true"
				aria-label={t("Log one off task")}
				className="absolute inset-0 flex h-dvh w-full flex-col bg-background shadow-xl sm:inset-auto sm:left-1/2 sm:top-1/2 sm:h-auto sm:w-[calc(100%-2rem)] sm:max-w-md sm:-translate-x-1/2 sm:-translate-y-1/2 sm:rounded-xl sm:border"
			>
				<div className="flex items-center justify-between gap-2 border-b px-4 py-4">
					<p className="text-sm font-semibold">{t("Log one off task")}</p>
					<Button type="button" variant="ghost" size="sm" onClick={onClose} disabled={isSubmitPending}>
						{t("Close")}
					</Button>
				</div>
				<div className="min-h-0 flex-1 space-y-4 overflow-y-auto p-4 sm:max-h-[80vh] sm:flex-none">
					<div className="space-y-2">
						<Label htmlFor="one-off-task-name" className="text-xs text-muted-foreground">
							{t("Task name")}
						</Label>
						<Input
							id="one-off-task-name"
							placeholder={t("Name your task")}
							value={taskLabel}
							onChange={(event) => setTaskLabel(event.target.value)}
							disabled={modalDisabled}
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
											modalDisabled ? "pointer-events-none opacity-50" : "hover:border-primary",
										)}
									>
										<input
											type="radio"
											name="one-off-bucket"
											value={bucket.key}
											checked={isSelected}
											onChange={() => setTaskBucket(bucket.key)}
											className="sr-only"
											disabled={modalDisabled}
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
						<Button type="button" variant="outline" onClick={onClose} disabled={modalDisabled}>
							{t("Cancel")}
						</Button>
						<Button type="button" onClick={handleSubmit} disabled={modalDisabled || !canSubmit}>
							{submitPending ? <Loader2Icon className="mr-2 h-4 w-4 animate-spin" /> : null}
							{t("Log one off task")}
						</Button>
					</div>
				</div>
			</div>
		</div>,
		document.body,
	);
};
