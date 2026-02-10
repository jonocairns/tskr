import { useMemo } from "react";

import type { PresetOption } from "@/components/task-actions/types";
import { normalizeText } from "@/components/task-actions/utils";
import { getLocalizedPresetTasks, PRESET_TASKS } from "@/lib/points";

type TranslateFn = (value: string, options?: Record<string, unknown>) => string;

type ResolvedPresetOption = PresetOption & {
	displayLabel: string;
	resolvedTemplateKey: string | null;
};

export const useLocalizedPresetOptions = (presetOptions: PresetOption[], t: TranslateFn) => {
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

	const resolvedPresetOptions = useMemo<ResolvedPresetOption[]>(() => {
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

	const localizedPresetOptions = useMemo<PresetOption[]>(() => {
		return resolvedPresetOptions.map(({ displayLabel, resolvedTemplateKey: _resolvedTemplateKey, ...preset }) => ({
			...preset,
			label: displayLabel,
		}));
	}, [resolvedPresetOptions]);

	const presetDisplayLabels = useMemo(() => {
		const lookup = new Map<string, string>();
		for (const preset of resolvedPresetOptions) {
			lookup.set(preset.id, preset.displayLabel);
		}
		return lookup;
	}, [resolvedPresetOptions]);

	const appliedTemplateKeys = useMemo(() => {
		return new Set(
			resolvedPresetOptions
				.map((preset) => preset.resolvedTemplateKey)
				.filter((templateKey): templateKey is string => Boolean(templateKey)),
		);
	}, [resolvedPresetOptions]);

	return {
		resolvedPresetOptions,
		localizedPresetOptions,
		presetDisplayLabels,
		appliedTemplateKeys,
	};
};
