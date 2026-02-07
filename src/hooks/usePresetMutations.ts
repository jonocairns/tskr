"use client";

import { useToast } from "@/hooks/useToast";
import type { PresetSummary } from "@/lib/dashboard/presets";
import type { DurationKey } from "@/lib/points";
import { trpc } from "@/lib/trpc/react";

type UsePresetMutationsOptions = {
	customPresets: PresetSummary[];
	setCustomPresets: React.Dispatch<React.SetStateAction<PresetSummary[]>>;
};

export const usePresetMutations = ({ customPresets, setCustomPresets }: UsePresetMutationsOptions) => {
	const { toast } = useToast();

	const createPresetMutation = trpc.presets.create.useMutation({
		onSuccess: (data) => {
			setCustomPresets((prev) => [
				{
					...data.preset,
					bucket: data.preset.bucket as DurationKey,
					templateKey: data.preset.templateKey ?? null,
					createdAt: data.preset.createdAt.toISOString(),
				},
				...prev,
			]);
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
		onMutate: async (variables) => {
			const previousPresets = customPresets;
			setCustomPresets((prev) =>
				prev.map((preset) =>
					preset.id === variables.id
						? {
								...preset,
								label: variables.label ?? preset.label,
								bucket: variables.bucket ?? preset.bucket,
								approvalOverride: variables.approvalOverride ?? preset.approvalOverride,
							}
						: preset,
				),
			);
			return { previousPresets };
		},
		onError: (error, _variables, context) => {
			if (context?.previousPresets) {
				setCustomPresets(context.previousPresets);
			}
			toast({
				title: "Unable to update preset",
				description: error.message ?? "Please try again.",
				variant: "destructive",
			});
		},
		onSuccess: (data) => {
			setCustomPresets((prev) =>
				prev.map((preset) =>
					preset.id === data.preset.id
						? {
								...data.preset,
								bucket: data.preset.bucket as DurationKey,
								templateKey: data.preset.templateKey ?? null,
								createdAt: data.preset.createdAt.toISOString(),
							}
						: preset,
				),
			);
			toast({ title: "Preset updated" });
		},
	});

	const deletePresetMutation = trpc.presets.delete.useMutation({
		onMutate: async (variables) => {
			const previousPresets = customPresets;
			setCustomPresets((prev) => prev.filter((item) => item.id !== variables.id));
			return { previousPresets };
		},
		onError: (error, _variables, context) => {
			if (context?.previousPresets) {
				setCustomPresets(context.previousPresets);
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
