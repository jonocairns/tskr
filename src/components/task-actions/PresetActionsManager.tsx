"use client";

import { useMemo } from "react";

import { useTaskActions } from "@/components/task-actions/Context";
import { PresetActionsDrawer } from "@/components/task-actions/PresetActionsDrawer";
import type { PresetTemplate } from "@/components/task-actions/types";
import { useLocalizedPresetOptions } from "@/components/task-actions/useLocalizedPresetOptions";
import { usePresetMutations } from "@/hooks/usePresetMutations";
import { useToast } from "@/hooks/useToast";
import { useTranslation } from "@/lib/i18nClient";
import { DURATION_BUCKETS, type DurationKey } from "@/lib/points";
import type { PresetIconKey } from "@/lib/presetIcons";

type PresetActionsManagerProps = {
	showListHeader?: boolean;
};

export const PresetActionsManager = ({ showListHeader = true }: PresetActionsManagerProps) => {
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
	} = useTaskActions();
	const { toast } = useToast();
	const { t } = useTranslation();
	const canManagePresets = currentUserRole !== "DOER";
	const canEditApprovalOverride = canManagePresets;

	const { createPresetMutation, updatePresetMutation, deletePresetMutation } = usePresetMutations({
		customPresets,
		setCustomPresetsAction: setCustomPresets,
	});

	const sortedEditablePresets = useMemo(() => {
		return [...customPresets.filter((preset) => preset.isShared || preset.createdById === currentUserId)].sort(
			(a, b) => {
				return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
			},
		);
	}, [currentUserId, customPresets]);

	const { appliedTemplateKeys, presetDisplayLabels } = useLocalizedPresetOptions(presetOptions, t);
	const templatesByBucket = useMemo(() => {
		return DURATION_BUCKETS.map((bucket) => ({
			bucket,
			templates: presetTemplates.filter(
				(template) => template.bucket === bucket.key && !appliedTemplateKeys.has(template.key),
			),
		})).filter((group) => group.templates.length > 0);
	}, [appliedTemplateKeys, presetTemplates]);

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
		iconKey?: PresetIconKey | null,
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
				iconKey,
			}),
		);
		if (success) {
			toast({
				title: t("Preset added"),
				description: t("Template added to your presets."),
				variant: "success",
			});
		}
		return success;
	};

	const handleCreatePreset = async (
		label: string,
		bucket: DurationKey,
		isShared: boolean,
		approvalOverride?: "REQUIRE" | "SKIP" | null,
		iconKey?: PresetIconKey | null,
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
				iconKey,
			}),
		);
	};

	const handleUpdatePreset = async (
		presetId: string,
		label: string,
		bucket: DurationKey,
		isShared: boolean,
		approvalOverride?: "REQUIRE" | "SKIP" | null,
		iconKey?: PresetIconKey | null,
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
				iconKey,
			}),
		);
	};

	const handleDeletePreset = async (presetId: string): Promise<boolean> => {
		return runPresetMutation(() => deletePresetMutation.mutateAsync({ householdId, id: presetId }));
	};

	return canManagePresets ? (
		<PresetActionsDrawer
			defaultBucket={defaultBucket}
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
			allowOneOffMode={false}
			showListHeader={showListHeader}
		/>
	) : null;
};
