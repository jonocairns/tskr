import { ClipboardListIcon } from "lucide-react";
import { DynamicIcon, type IconName, iconNames } from "lucide-react/dynamic";

import { normalizePresetIconKey, type PresetIconKey } from "@/lib/presetIcons";

export type PresetIconOption = {
	key: IconName;
	label: string;
	searchValue: string;
};

const iconNameSet = new Set<string>(iconNames);

const splitIconName = (value: string) => {
	return value
		.split("-")
		.filter(Boolean)
		.map((segment) => `${segment.charAt(0).toUpperCase()}${segment.slice(1)}`)
		.join(" ");
};

const toKebabCase = (value: string) => {
	return value
		.replace(/([a-z0-9])([A-Z])/g, "$1-$2")
		.replace(/([A-Za-z])([0-9])/g, "$1-$2")
		.replace(/([0-9])([A-Za-z])/g, "$1-$2")
		.replace(/[_\s]+/g, "-")
		.toLowerCase();
};

const presetIconOptionsInternal: PresetIconOption[] = [...iconNames]
	.sort((a, b) => a.localeCompare(b))
	.map((name) => {
		const label = splitIconName(name);
		return {
			key: name,
			label,
			searchValue: `${label} ${name} ${name.replace(/-/g, "")}`.toLowerCase(),
		};
	});

const presetIconLabelByKey = new Map(presetIconOptionsInternal.map((option) => [option.key, option.label]));

export const PRESET_ICON_OPTIONS = presetIconOptionsInternal;

export const resolvePresetIconKey = (iconKey?: string | null): IconName | null => {
	const normalized = normalizePresetIconKey(iconKey);
	if (!normalized) {
		return null;
	}

	if (iconNameSet.has(normalized)) {
		return normalized as IconName;
	}

	const kebab = toKebabCase(normalized);
	if (iconNameSet.has(kebab)) {
		return kebab as IconName;
	}

	return null;
};

export const getPresetIconLabel = (iconKey?: string | null): string => {
	const resolved = resolvePresetIconKey(iconKey);
	if (!resolved) {
		return "General";
	}
	return presetIconLabelByKey.get(resolved) ?? splitIconName(resolved);
};

type PresetIconGlyphProps = {
	iconKey?: PresetIconKey | null;
	className?: string;
	ariaHidden?: boolean;
};

export const PresetIconGlyph = ({ iconKey, className, ariaHidden = true }: PresetIconGlyphProps) => {
	const resolved = resolvePresetIconKey(iconKey) ?? "clipboard-list";

	return (
		<DynamicIcon
			name={resolved}
			className={className}
			aria-hidden={ariaHidden}
			fallback={() => <ClipboardListIcon className={className} aria-hidden={ariaHidden} />}
		/>
	);
};
