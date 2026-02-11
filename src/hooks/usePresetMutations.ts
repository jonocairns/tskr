"use client";

import { useToast } from "@/hooks/useToast";
import type { PresetSummary } from "@/lib/dashboard/presets";
import { useTranslation } from "@/lib/i18nClient";
import type { DurationKey } from "@/lib/points";
import { normalizePresetIconKey } from "@/lib/presetIcons";
import { shouldClearTemplateKeyOnPresetUpdate } from "@/lib/presetTemplateKey";
import { trpc } from "@/lib/trpc/react";

type UsePresetMutationsOptions = {
	customPresets: PresetSummary[];
	setCustomPresetsAction: React.Dispatch<React.SetStateAction<PresetSummary[]>>;
};

const normalizePreset = <
	TPreset extends {
		bucket: string;
		templateKey: string | null;
		iconKey: string | null;
		sortOrder: number;
		createdAt: Date;
	},
>(
	preset: TPreset,
) => ({
	...preset,
	bucket: preset.bucket as DurationKey,
	templateKey: preset.templateKey ?? null,
	iconKey: normalizePresetIconKey(preset.iconKey),
	createdAt: preset.createdAt.toISOString(),
});

export const usePresetMutations = ({ customPresets, setCustomPresetsAction }: UsePresetMutationsOptions) => {
	const { toast } = useToast();
	const { t } = useTranslation();

	const createPresetMutation = trpc.presets.create.useMutation({
		onSuccess: (data) => {
			setCustomPresetsAction((prev) => [normalizePreset(data.preset), ...prev]);
			toast({
				title: t("Preset added"),
				description: t("Chore added to your presets."),
				variant: "success",
			});
		},
		onError: (error) => {
			toast({
				title: t("Unable to add preset"),
				description: error.message ?? t("Please try again."),
				variant: "destructive",
			});
		},
	});

	const updatePresetMutation = trpc.presets.update.useMutation({
		onMutate: (variables) => {
			const previousPresets = customPresets;
			setCustomPresetsAction((prev) =>
				prev.map((preset) =>
					preset.id === variables.id
						? {
								...preset,
								label: variables.label ?? preset.label,
								bucket: variables.bucket ?? preset.bucket,
								templateKey: shouldClearTemplateKeyOnPresetUpdate({
									templateKey: preset.templateKey,
									currentLabel: preset.label,
									currentBucket: preset.bucket,
									nextLabel: variables.label,
									nextBucket: variables.bucket,
								})
									? null
									: preset.templateKey,
								iconKey: variables.iconKey !== undefined ? variables.iconKey : preset.iconKey,
								approvalOverride: variables.approvalOverride ?? preset.approvalOverride,
							}
						: preset,
				),
			);
			return { previousPresets };
		},
		onError: (error, _variables, context) => {
			if (context?.previousPresets) {
				setCustomPresetsAction(context.previousPresets);
			}
			toast({
				title: t("Unable to update preset"),
				description: error.message ?? t("Please try again."),
				variant: "destructive",
			});
		},
		onSuccess: (data) => {
			const updatedPreset = normalizePreset(data.preset);
			setCustomPresetsAction((prev) =>
				prev.map((preset) =>
					preset.id === updatedPreset.id
						? {
								...updatedPreset,
								sortOrder: preset.sortOrder,
							}
						: preset,
				),
			);
			toast({ title: t("Preset updated"), variant: "success" });
		},
	});

	const deletePresetMutation = trpc.presets.delete.useMutation({
		onMutate: (variables) => {
			const previousPresets = customPresets;
			setCustomPresetsAction((prev) => prev.filter((item) => item.id !== variables.id));
			return { previousPresets };
		},
		onError: (error, _variables, context) => {
			if (context?.previousPresets) {
				setCustomPresetsAction(context.previousPresets);
			}
			toast({
				title: t("Unable to delete preset"),
				description: error.message ?? t("Please try again."),
				variant: "destructive",
			});
		},
		onSuccess: () => {
			toast({ title: t("Preset deleted"), variant: "success" });
		},
	});

	const reorderPresetMutation = trpc.presets.reorder.useMutation({
		onMutate: (variables) => {
			const previousPresets = customPresets;
			const sortOrderById = new Map(variables.orderedPresetIds.map((presetId, index) => [presetId, index]));
			setCustomPresetsAction((prev) =>
				prev.map((preset) => {
					const nextSortOrder = sortOrderById.get(preset.id);
					if (nextSortOrder === undefined) {
						return preset;
					}

					return {
						...preset,
						sortOrder: nextSortOrder,
					};
				}),
			);

			return { previousPresets };
		},
		onError: (error, _variables, context) => {
			if (context?.previousPresets) {
				setCustomPresetsAction(context.previousPresets);
			}
			toast({
				title: t("Unable to reorder presets"),
				description: error.message ?? t("Please try again."),
				variant: "destructive",
			});
		},
	});

	return {
		createPresetMutation,
		updatePresetMutation,
		deletePresetMutation,
		reorderPresetMutation,
	};
};
