"use client";

import { PencilIcon, XIcon } from "lucide-react";
import { type ReactNode, useMemo, useState } from "react";

import { QUICK_LOG_ANCHOR } from "@/components/PointsSummary";
import { useTaskActions } from "@/components/task-actions/Context";
import { OneOffTaskModal } from "@/components/task-actions/OneOffTaskModal";
import { PresetActionsManager } from "@/components/task-actions/PresetActionsManager";
import { TaskConfirmationDialog } from "@/components/task-actions/TaskConfirmationDialog";
import { TaskGrid } from "@/components/task-actions/TaskGrid";
import { TaskSearchBar } from "@/components/task-actions/TaskSearchBar";
import { useLocalizedPresetOptions } from "@/components/task-actions/useLocalizedPresetOptions";
import { normalizeText, sortEditablePresets } from "@/components/task-actions/utils";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/Card";
import { useLogMutation } from "@/hooks/useLogMutation";
import { useTranslation } from "@/lib/i18nClient";
import type { DurationKey } from "@/lib/points";
import { cn } from "@/lib/utils";

export const PresetActionsCard = ({ headerAction }: { headerAction?: ReactNode }) => {
	const {
		householdId,
		presetOptions,
		customPresets,
		currentUserId,
		currentUserRole,
		disabled,
		defaultBucket,
		logPreset,
	} = useTaskActions();
	const [lastPressedTaskId, setLastPressedTaskId] = useState<string | null>(null);
	const [confirmDialogOpen, setConfirmDialogOpen] = useState(false);
	const [pendingTaskId, setPendingTaskId] = useState<string | null>(null);
	const [oneOffModalOpen, setOneOffModalOpen] = useState(false);
	const [searchQuery, setSearchQuery] = useState("");
	const [isEditMode, setIsEditMode] = useState(false);

	const { t } = useTranslation();
	const canManagePresets = currentUserRole !== "DOER";
	const createLogMutation = useLogMutation();

	const { localizedPresetOptions } = useLocalizedPresetOptions(presetOptions, t);
	const sortedEditablePresets = useMemo(() => {
		return sortEditablePresets(customPresets, currentUserId);
	}, [customPresets, currentUserId]);
	const localizedLabelById = useMemo(() => {
		return new Map(localizedPresetOptions.map((preset) => [preset.id, preset.label]));
	}, [localizedPresetOptions]);
	const sortedLocalizedPresets = useMemo(() => {
		return sortedEditablePresets.map((preset) => ({
			id: preset.id,
			label: localizedLabelById.get(preset.id) ?? preset.label,
			bucket: preset.bucket,
			templateKey: preset.templateKey,
			iconKey: preset.iconKey,
			isShared: preset.isShared,
			sortOrder: preset.sortOrder,
		}));
	}, [localizedLabelById, sortedEditablePresets]);
	const normalizedQuery = normalizeText(searchQuery);
	const filteredPresets =
		normalizedQuery.length > 0
			? sortedLocalizedPresets.filter((preset) => normalizeText(preset.label).includes(normalizedQuery))
			: sortedLocalizedPresets;

	const logTask = (taskId: string) =>
		logPreset(
			{ presetId: taskId },
			undefined,
			() => setLastPressedTaskId(taskId),
			() => setLastPressedTaskId((current) => (current === taskId ? null : current)),
		);

	const handleTaskClick = (taskId: string) => {
		if (lastPressedTaskId === taskId) {
			setPendingTaskId(taskId);
			setConfirmDialogOpen(true);
		} else {
			logTask(taskId);
		}
	};

	const handleConfirmLog = () => {
		if (pendingTaskId) {
			const taskId = pendingTaskId;
			logTask(taskId);
		}
		setConfirmDialogOpen(false);
		setPendingTaskId(null);
	};

	const handleCancelLog = () => {
		setConfirmDialogOpen(false);
		setPendingTaskId(null);
	};

	const handleLogTimed = async (label: string, bucket: DurationKey): Promise<boolean> => {
		if (label.trim().length < 2) {
			return false;
		}

		return new Promise<boolean>((resolve) => {
			createLogMutation.mutate(
				{
					householdId,
					type: "timed",
					bucket,
					description: label.trim(),
				},
				{
					onSuccess: () => resolve(true),
					onError: () => resolve(false),
				},
			);
		});
	};

	const handleToggleEditMode = () => {
		setIsEditMode((previous) => !previous);
		setConfirmDialogOpen(false);
		setPendingTaskId(null);
		setOneOffModalOpen(false);
	};

	return (
		<>
			<Card
				id={QUICK_LOG_ANCHOR}
				className={cn(
					"relative scroll-mt-4 overflow-hidden transition-colors",
					isEditMode ? "border-primary/60" : null,
				)}
			>
				{isEditMode ? (
					<div className="pointer-events-none absolute inset-0 rounded-xl border border-transparent animate-edit-border-pulse" />
				) : null}
				<CardHeader className="space-y-1">
					<div className="flex items-start justify-between gap-2">
						<div className="space-y-1">
							<div className="flex h-7 items-center gap-2">
								<CardTitle className="whitespace-nowrap text-xl">{t("Quick log")}</CardTitle>
								{/* Rendered only in edit mode so the hidden chip never takes room from the header action. */}
								{isEditMode ? (
									<Badge
										variant="secondary"
										className="h-5 px-2 text-[10px] uppercase tracking-wide motion-safe:animate-in motion-safe:fade-in"
									>
										<span className="text-rainbow-smooth animate-edit-mode-rainbow-pulse [text-shadow:0_0_10px_rgba(255,255,255,0.15)]">
											{t("Edit mode")}
										</span>
									</Badge>
								) : null}
							</div>
							<CardDescription className="min-h-5 leading-5">
								{isEditMode
									? t("Add or edit tasks")
									: t("Log work in one tap. Taps count towards matching listed tasks.")}
							</CardDescription>
						</div>
						<div className="flex items-center gap-1">
							{isEditMode ? null : headerAction}
							{canManagePresets ? (
								<Button
									type="button"
									variant="ghost"
									size="icon"
									aria-label={isEditMode ? t("Close") : t("Manage quick log")}
									onClick={handleToggleEditMode}
									className={cn(
										"border border-transparent",
										isEditMode ? "border-primary/50 bg-secondary text-secondary-foreground" : null,
									)}
								>
									{isEditMode ? <XIcon className="h-4 w-4" /> : <PencilIcon className="h-4 w-4" />}
								</Button>
							) : null}
						</div>
					</div>
				</CardHeader>
				<CardContent className="space-y-4">
					{isEditMode ? (
						<PresetActionsManager showListHeader={false} />
					) : (
						<>
							<TaskSearchBar searchQuery={searchQuery} onSearchChange={setSearchQuery} />
							<TaskGrid
								presetOptions={sortedLocalizedPresets}
								filteredPresets={filteredPresets}
								disabled={disabled}
								onTaskClick={handleTaskClick}
								onOneOffClick={() => setOneOffModalOpen(true)}
							/>
						</>
					)}
				</CardContent>
			</Card>
			{isEditMode ? null : (
				<>
					<OneOffTaskModal
						open={oneOffModalOpen}
						onClose={() => setOneOffModalOpen(false)}
						defaultBucket={defaultBucket}
						disabled={disabled || createLogMutation.isPending}
						isPending={createLogMutation.isPending}
						onSubmit={handleLogTimed}
					/>
					<TaskConfirmationDialog
						open={confirmDialogOpen}
						onOpenChange={setConfirmDialogOpen}
						onConfirm={handleConfirmLog}
						onCancel={handleCancelLog}
					/>
				</>
			)}
		</>
	);
};
