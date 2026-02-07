"use client";

import { useMemo, useState } from "react";

import { useTaskActions } from "@/components/task-actions/Context";
import { PresetActionsDrawer } from "@/components/task-actions/PresetActionsDrawer";
import { TaskConfirmationDialog } from "@/components/task-actions/TaskConfirmationDialog";
import { TaskGrid } from "@/components/task-actions/TaskGrid";
import { TaskSearchBar } from "@/components/task-actions/TaskSearchBar";
import type { PresetTemplate } from "@/components/task-actions/types";
import { normalizeText } from "@/components/task-actions/utils";
import { Button } from "@/components/ui/Button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/Card";
import { useLogMutation } from "@/hooks/useLogMutation";
import { usePresetMutations } from "@/hooks/usePresetMutations";
import { useToast } from "@/hooks/useToast";
import { useTranslation } from "@/lib/i18nClient";
import { DURATION_BUCKETS, type DurationKey, getPresetTasks } from "@/lib/points";

export const PresetActionsCard = () => {
	const {
		householdId,
		presetOptions,
		presetTemplates,
		customPresets,
		setCustomPresets,
		currentUserId,
		currentUserRole,
		disabled,
		defaultBucket,
		isPending,
		isPresetPending,
		startPresetTransition,
		logPreset,
	} = useTaskActions();
	const [isEditDrawerOpen, setEditDrawerOpen] = useState(false);
	const [lastPressedTaskId, setLastPressedTaskId] = useState<string | null>(null);
	const [confirmDialogOpen, setConfirmDialogOpen] = useState(false);
	const [pendingTaskId, setPendingTaskId] = useState<string | null>(null);

	const { toast } = useToast();
	const { t } = useTranslation();
	const canManagePresets = currentUserRole !== "DOER";
	const canEditApprovalOverride = currentUserRole !== "DOER";
	const [searchQuery, setSearchQuery] = useState("");

	const { createPresetMutation, updatePresetMutation, deletePresetMutation } = usePresetMutations({
		customPresets,
		setCustomPresets,
	});

	const createLogMutation = useLogMutation();

	const editablePresets = customPresets.filter((preset) => preset.isShared || preset.createdById === currentUserId);
	const sortedEditablePresets = [...editablePresets].sort((a, b) => {
		return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
	});
	const templateKeyByLabelBucket = useMemo(() => {
		const templates = [...getPresetTasks(), ...getPresetTasks(t)];
		const lookup = new Map<string, string>();
		for (const template of templates) {
			lookup.set(`${normalizeText(template.label)}|${template.bucket}`, template.key);
		}
		return lookup;
	}, [t]);
	const appliedTemplateKeys = new Set(
		presetOptions
			.map((preset) => templateKeyByLabelBucket.get(`${normalizeText(preset.label)}|${preset.bucket}`))
			.filter((key): key is string => Boolean(key)),
	);
	const templatesByBucket = DURATION_BUCKETS.map((bucket) => ({
		bucket,
		templates: presetTemplates.filter(
			(template) => template.bucket === bucket.key && !appliedTemplateKeys.has(template.key),
		),
	})).filter((group) => group.templates.length > 0);
	const normalizedQuery = normalizeText(searchQuery);
	const filteredPresets =
		normalizedQuery.length > 0
			? presetOptions.filter((preset) => normalizeText(preset.label).includes(normalizedQuery))
			: presetOptions;

	const handleCreatePresetFromTemplate = async (
		template: PresetTemplate,
		isShared: boolean,
		approvalOverride?: "REQUIRE" | "SKIP" | null,
	) => {
		if (appliedTemplateKeys.has(template.key)) {
			return false;
		}

		let success = false;
		await new Promise<void>((resolve) =>
			startPresetTransition(async () => {
				try {
					await createPresetMutation.mutateAsync({
						householdId,
						label: template.label,
						bucket: template.bucket,
						isShared,
						approvalOverride,
					});
					success = true;
					toast({
						title: t("Preset added"),
						description: t("Template added to your presets."),
					});
				} catch {
					// Error handled by mutation onError
				}
				resolve();
			}),
		);
		return success;
	};

	const handleCreatePreset = async (
		label: string,
		bucket: DurationKey,
		isShared: boolean,
		approvalOverride?: "REQUIRE" | "SKIP" | null,
	): Promise<boolean> => {
		if (label.trim().length < 2) {
			return false;
		}

		let success = false;
		await new Promise<void>((resolve) =>
			startPresetTransition(async () => {
				try {
					await createPresetMutation.mutateAsync({
						householdId,
						label: label.trim(),
						bucket,
						isShared,
						approvalOverride,
					});
					success = true;
				} catch {
					// Error handled by mutation onError
				}
				resolve();
			}),
		);

		return success;
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

	const closeEditDrawer = () => {
		setEditDrawerOpen(false);
	};

	const handleUpdatePreset = async (
		presetId: string,
		label: string,
		bucket: DurationKey,
		isShared: boolean,
		approvalOverride?: "REQUIRE" | "SKIP" | null,
	): Promise<boolean> => {
		if (label.trim().length < 2) {
			return false;
		}

		let success = false;
		await new Promise<void>((resolve) =>
			startPresetTransition(async () => {
				try {
					await updatePresetMutation.mutateAsync({
						householdId,
						id: presetId,
						label: label.trim(),
						bucket,
						isShared,
						approvalOverride,
					});
					success = true;
				} catch {
					// Error handled by mutation onError
				}
				resolve();
			}),
		);
		return success;
	};

	const handleDeletePreset = async (presetId: string): Promise<boolean> => {
		let success = false;
		await new Promise<void>((resolve) =>
			startPresetTransition(async () => {
				try {
					await deletePresetMutation.mutateAsync({ householdId, id: presetId });
					success = true;
				} catch {
					// Error handled by mutation onError
				}
				resolve();
			}),
		);
		return success;
	};

	const handleTaskClick = (taskId: string) => {
		if (lastPressedTaskId === taskId) {
			// Same task pressed consecutively, show confirmation dialog
			setPendingTaskId(taskId);
			setConfirmDialogOpen(true);
		} else {
			// Different task or first press, log immediately
			setLastPressedTaskId(taskId);
			logPreset({ presetId: taskId });
		}
	};

	const handleConfirmLog = () => {
		if (pendingTaskId) {
			logPreset({ presetId: pendingTaskId });
			setLastPressedTaskId(pendingTaskId);
		}
		setConfirmDialogOpen(false);
		setPendingTaskId(null);
	};

	const handleCancelLog = () => {
		setConfirmDialogOpen(false);
		setPendingTaskId(null);
	};

	return (
		<>
			<Card>
				<CardHeader className="space-y-1">
					<div className="flex items-start justify-between gap-2">
						<div className="space-y-1">
							<CardTitle className="text-xl">{t("Tasks")}</CardTitle>
							<CardDescription>{t("Tap a task once you've completed it.")}</CardDescription>
						</div>
						{canManagePresets ? (
							<Button type="button" variant="ghost" size="sm" onClick={() => setEditDrawerOpen(true)}>
								{t("Change")}
							</Button>
						) : null}
					</div>
				</CardHeader>
				<CardContent className="space-y-4">
					<TaskSearchBar searchQuery={searchQuery} onSearchChange={setSearchQuery} onClear={() => setSearchQuery("")} />
					<TaskGrid
						presetOptions={presetOptions}
						filteredPresets={filteredPresets}
						disabled={disabled}
						onTaskClick={handleTaskClick}
					/>
				</CardContent>
			</Card>
			<PresetActionsDrawer
				isOpen={isEditDrawerOpen}
				onClose={closeEditDrawer}
				defaultBucket={defaultBucket}
				onLogTimed={handleLogTimed}
				onCreatePreset={handleCreatePreset}
				onCreatePresetFromTemplate={handleCreatePresetFromTemplate}
				onUpdatePreset={handleUpdatePreset}
				onDeletePreset={handleDeletePreset}
				templatesByBucket={templatesByBucket}
				disabled={disabled}
				isPending={isPending}
				isPresetPending={isPresetPending}
				sortedEditablePresets={sortedEditablePresets}
				currentUserId={currentUserId}
				canEditApprovalOverride={canEditApprovalOverride}
				canManagePresets={canManagePresets}
			/>
			<TaskConfirmationDialog
				open={confirmDialogOpen}
				onOpenChange={setConfirmDialogOpen}
				onConfirm={handleConfirmLog}
				onCancel={handleCancelLog}
			/>
		</>
	);
};
