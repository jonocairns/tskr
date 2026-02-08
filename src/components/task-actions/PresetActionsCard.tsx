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
import { DURATION_BUCKETS, type DurationKey, getLocalizedPresetTasks, PRESET_TASKS } from "@/lib/points";

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
	const canEditApprovalOverride = canManagePresets;
	const [searchQuery, setSearchQuery] = useState("");

	const { createPresetMutation, updatePresetMutation, deletePresetMutation } = usePresetMutations({
		customPresets,
		setCustomPresetsAction: setCustomPresets,
	});

	const createLogMutation = useLogMutation();

	const sortedEditablePresets = useMemo(() => {
		return [...customPresets.filter((preset) => preset.isShared || preset.createdById === currentUserId)].sort(
			(a, b) => {
				return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
			},
		);
	}, [currentUserId, customPresets]);
	const localizedPresetLabels = useMemo(() => {
		return new Map(getLocalizedPresetTasks(t).map((task) => [task.key, task.label]));
	}, [t]);
	const templateKeyByLabelBucket = useMemo(() => {
		const templates = [...PRESET_TASKS, ...getLocalizedPresetTasks(t)];
		const lookup = new Map<string, string>();
		for (const template of templates) {
			lookup.set(`${normalizeText(template.label)}|${template.bucket}`, template.key);
		}
		return lookup;
	}, [t]);
	const resolvedPresetOptions = useMemo(() => {
		return presetOptions.map((preset) => {
			const resolvedTemplateKey =
				preset.templateKey ?? templateKeyByLabelBucket.get(`${normalizeText(preset.label)}|${preset.bucket}`) ?? null;
			const displayLabel = resolvedTemplateKey
				? (localizedPresetLabels.get(resolvedTemplateKey) ?? preset.label)
				: preset.label;
			return {
				...preset,
				displayLabel,
				resolvedTemplateKey,
			};
		});
	}, [localizedPresetLabels, presetOptions, templateKeyByLabelBucket]);
	const presetDisplayLabels = useMemo(() => {
		const lookup = new Map<string, string>();
		for (const preset of resolvedPresetOptions) {
			lookup.set(preset.id, preset.displayLabel);
		}
		return lookup;
	}, [resolvedPresetOptions]);
	const localizedPresetOptions = useMemo(() => {
		return resolvedPresetOptions.map((preset) => ({
			id: preset.id,
			label: preset.displayLabel,
			bucket: preset.bucket,
			templateKey: preset.templateKey,
			isShared: preset.isShared,
		}));
	}, [resolvedPresetOptions]);
	const appliedTemplateKeys = useMemo(() => {
		return new Set(
			resolvedPresetOptions
				.map((preset) => preset.resolvedTemplateKey)
				.filter((templateKey): templateKey is string => Boolean(templateKey)),
		);
	}, [resolvedPresetOptions]);
	const templatesByBucket = useMemo(() => {
		return DURATION_BUCKETS.map((bucket) => ({
			bucket,
			templates: presetTemplates.filter(
				(template) => template.bucket === bucket.key && !appliedTemplateKeys.has(template.key),
			),
		})).filter((group) => group.templates.length > 0);
	}, [appliedTemplateKeys, presetTemplates]);
	const normalizedQuery = normalizeText(searchQuery);
	const filteredPresets =
		normalizedQuery.length > 0
			? localizedPresetOptions.filter((preset) => normalizeText(preset.label).includes(normalizedQuery))
			: localizedPresetOptions;

	const runPresetMutation = async (mutation: () => Promise<unknown>) => {
		return new Promise<boolean>((resolve) =>
			startPresetTransition(() => {
				void mutation()
					.then(() => resolve(true))
					.catch(() => resolve(false));
			}),
		);
	};

	const handleCreatePresetFromTemplate = async (
		template: PresetTemplate,
		isShared: boolean,
		approvalOverride?: "REQUIRE" | "SKIP" | null,
	) => {
		if (appliedTemplateKeys.has(template.key)) {
			return false;
		}

		const success = await runPresetMutation(() =>
			createPresetMutation.mutateAsync({
				householdId,
				label: template.label,
				bucket: template.bucket,
				templateKey: template.key,
				isShared,
				approvalOverride,
			}),
		);
		if (success) {
			toast({
				title: t("Preset added"),
				description: t("Template added to your presets."),
			});
		}
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

		return runPresetMutation(() =>
			createPresetMutation.mutateAsync({
				householdId,
				label: label.trim(),
				bucket,
				isShared,
				approvalOverride,
			}),
		);
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

		return runPresetMutation(() =>
			updatePresetMutation.mutateAsync({
				householdId,
				id: presetId,
				label: label.trim(),
				bucket,
				isShared,
				approvalOverride,
			}),
		);
	};

	const handleDeletePreset = async (presetId: string): Promise<boolean> => {
		return runPresetMutation(() => deletePresetMutation.mutateAsync({ householdId, id: presetId }));
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
						presetOptions={localizedPresetOptions}
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
				presetDisplayLabels={presetDisplayLabels}
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
