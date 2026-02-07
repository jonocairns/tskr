"use client";

import { useToast } from "@/hooks/useToast";
import type { PresetSummary } from "@/lib/dashboard/presets";
import type { DurationKey } from "@/lib/points";
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
		createdAt: Date;
	},
>(
	preset: TPreset,
) => ({
	...preset,
	bucket: preset.bucket as DurationKey,
	templateKey: preset.templateKey ?? null,
	createdAt: preset.createdAt.toISOString(),
});

export const usePresetMutations = ({ customPresets, setCustomPresetsAction }: UsePresetMutationsOptions) => {
	const { toast } = useToast();

	const createPresetMutation = trpc.presets.create.useMutation({
		onSuccess: (data) => {
			setCustomPresetsAction((prev) => [normalizePreset(data.preset), ...prev]);
			toast({
				title: "Preset added",
				description: "Chore added to your presets.",
			});
		},
		onError: (error) => {
			toast({
				title: "Unable to add preset",
				description: error.message ?? "Please try again.",
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
				title: "Unable to update preset",
				description: error.message ?? "Please try again.",
				variant: "destructive",
			});
		},
		onSuccess: (data) => {
			const updatedPreset = normalizePreset(data.preset);
			setCustomPresetsAction((prev) => prev.map((preset) => (preset.id === updatedPreset.id ? updatedPreset : preset)));
			toast({ title: "Preset updated" });
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
				title: "Unable to delete preset",
				description: error.message ?? "Please try again.",
				variant: "destructive",
			});
		},
		onSuccess: () => {
			toast({ title: "Preset deleted" });
		},
	});

	return {
		createPresetMutation,
		updatePresetMutation,
		deletePresetMutation,
	};
};
