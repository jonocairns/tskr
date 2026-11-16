"use client";

import { useMemo } from "react";

import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/Select";
import { useTranslation } from "@/lib/i18nClient";
import { type DurationKey, getLocalizedDurationBuckets } from "@/lib/points";
import type { PresetApprovalOverride } from "@/lib/presetInput";

export type ApprovalOverrideOption = "DEFAULT" | "REQUIRE" | "SKIP";

export const resolveApprovalOverride = (canEdit: boolean, value: ApprovalOverrideOption): PresetApprovalOverride => {
	if (!canEdit) {
		return undefined;
	}
	if (value === "DEFAULT") {
		return null;
	}
	return value;
};

type PresetBucketSelectProps = {
	id?: string;
	value: DurationKey;
	onChange: (value: DurationKey) => void;
	disabled?: boolean;
};

export const PresetBucketSelect = ({ id, value, onChange, disabled }: PresetBucketSelectProps) => {
	const { t } = useTranslation();
	const localizedBuckets = useMemo(() => getLocalizedDurationBuckets(t), [t]);

	return (
		<Select value={value} onValueChange={(next: DurationKey) => onChange(next)} disabled={disabled}>
			<SelectTrigger id={id}>
				<SelectValue placeholder={t("Bucket")} />
			</SelectTrigger>
			<SelectContent>
				{localizedBuckets.map((bucket) => (
					<SelectItem key={bucket.key} value={bucket.key}>
						{bucket.label} ({bucket.points} pts)
					</SelectItem>
				))}
			</SelectContent>
		</Select>
	);
};

type PresetApprovalOverrideSelectProps = {
	id?: string;
	value: ApprovalOverrideOption;
	onChange: (value: ApprovalOverrideOption) => void;
	disabled?: boolean;
};

export const PresetApprovalOverrideSelect = ({ id, value, onChange, disabled }: PresetApprovalOverrideSelectProps) => {
	const { t } = useTranslation();

	return (
		<Select value={value} onValueChange={(next: ApprovalOverrideOption) => onChange(next)} disabled={disabled}>
			<SelectTrigger id={id}>
				<SelectValue placeholder={t("Use member default")} />
			</SelectTrigger>
			<SelectContent>
				<SelectItem value="DEFAULT">{t("Use member default")}</SelectItem>
				<SelectItem value="REQUIRE">{t("Require approval")}</SelectItem>
				<SelectItem value="SKIP">{t("Skip approval")}</SelectItem>
			</SelectContent>
		</Select>
	);
};
