import { Loader2Icon } from "lucide-react";
import type { SyntheticEvent } from "react";
import { useEffect, useMemo, useState } from "react";

import { PresetListItem } from "@/components/task-actions/PresetListItem";
import type { PresetSummary, PresetTemplate } from "@/components/task-actions/types";
import { Button } from "@/components/ui/Button";
import { CardDescription, CardTitle } from "@/components/ui/Card";
import { Input } from "@/components/ui/Input";
import { Label } from "@/components/ui/Label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/Select";
import { useTranslation } from "@/lib/i18nClient";
import type { DurationKey } from "@/lib/points";
import { getDurationBuckets, getPresetTasks } from "@/lib/points";
import { cn } from "@/lib/utils";

type ApprovalOverrideOption = "DEFAULT" | "REQUIRE" | "SKIP";

const BUCKET_WINDOW_SHORT: Record<DurationKey, string> = {
	TINY: "<1m",
	QUICK: "1-5m",
	ROUTINE: "5-15m",
	CHALLENGING: "15-30m",
	HEAVY: "30-60m",
	MAJOR: "60-120m",
};

type TemplatesByBucket = Array<{
	bucket: ReturnType<typeof getDurationBuckets>[number];
	templates: PresetTemplate[];
}>;

type Props = {
	isOpen: boolean;
	onClose: () => void;
	defaultBucket: DurationKey;
	onLogTimed: (label: string, bucket: DurationKey) => Promise<boolean>;
	onCreatePreset: (
		label: string,
		bucket: DurationKey,
		isShared: boolean,
		approvalOverride?: "REQUIRE" | "SKIP" | null,
	) => Promise<boolean>;
	onCreatePresetFromTemplate: (
		template: PresetTemplate,
		isShared: boolean,
		approvalOverride?: "REQUIRE" | "SKIP" | null,
	) => Promise<boolean>;
	onUpdatePreset: (
		presetId: string,
		label: string,
		bucket: DurationKey,
		isShared: boolean,
		approvalOverride?: "REQUIRE" | "SKIP" | null,
	) => Promise<boolean>;
	onDeletePreset: (presetId: string) => Promise<boolean>;
	templatesByBucket: TemplatesByBucket;
	disabled: boolean;
	isPending: boolean;
	isPresetPending: boolean;
	sortedEditablePresets: PresetSummary[];
	currentUserId: string;
	canEditApprovalOverride: boolean;
	canManagePresets: boolean;
};

const resolveApprovalOverride = (
	canEdit: boolean,
	value: ApprovalOverrideOption,
): "REQUIRE" | "SKIP" | null | undefined => {
	if (!canEdit) {
		return undefined;
	}
	if (value === "DEFAULT") {
		return null;
	}
	return value;
};

export function PresetActionsDrawer({
	isOpen,
	onClose,
	defaultBucket,
	onLogTimed,
	onCreatePreset,
	onCreatePresetFromTemplate,
	onUpdatePreset,
	onDeletePreset,
	templatesByBucket,
	disabled,
	isPending,
	isPresetPending,
	sortedEditablePresets,
	currentUserId,
	canEditApprovalOverride,
	canManagePresets,
}: Props) {
	const { t } = useTranslation();
	const localizedBuckets = useMemo(() => getDurationBuckets(t), [t]);
	const localizedPresetLabels = useMemo(() => {
		return new Map(getPresetTasks(t).map((task) => [task.key, task.label]));
	}, [t]);
	const [customLabel, setCustomLabel] = useState("");
	const [customBucket, setCustomBucket] = useState<DurationKey>(defaultBucket);
	const [customApprovalOverride, setCustomApprovalOverride] = useState<ApprovalOverrideOption>("DEFAULT");
	const [customIsShared, setCustomIsShared] = useState(true);
	const [editingPresetId, setEditingPresetId] = useState<string | null>(null);
	const [editLabel, setEditLabel] = useState("");
	const [editBucket, setEditBucket] = useState<DurationKey>(defaultBucket);
	const [editApprovalOverride, setEditApprovalOverride] = useState<ApprovalOverrideOption>("DEFAULT");
	const [editIsShared, setEditIsShared] = useState(true);

	useEffect(() => {
		if (!isOpen) {
			setCustomLabel("");
			setCustomBucket(defaultBucket);
			setCustomApprovalOverride("DEFAULT");
			setCustomIsShared(true);
			setEditingPresetId(null);
			setEditLabel("");
			setEditBucket(defaultBucket);
			setEditApprovalOverride("DEFAULT");
			setEditIsShared(true);
		}
	}, [isOpen, defaultBucket]);

	const resetCustomForm = (): void => {
		setCustomLabel("");
		setCustomBucket(defaultBucket);
		setCustomApprovalOverride("DEFAULT");
		setCustomIsShared(true);
	};

	const canCreate = customLabel.trim().length >= 2;
	const canUpdate = editLabel.trim().length >= 2;

	if (!isOpen) return null;

	const handleCreatePreset = async (): Promise<void> => {
		if (!canCreate) return;
		const approvalOverride = resolveApprovalOverride(canEditApprovalOverride, customApprovalOverride);
		const success = await onCreatePreset(customLabel, customBucket, customIsShared, approvalOverride);
		if (success) {
			resetCustomForm();
		}
	};

	const handleCreatePresetFromTemplate = async (template: PresetTemplate): Promise<void> => {
		const approvalOverride = resolveApprovalOverride(canEditApprovalOverride, customApprovalOverride);
		const localizedTemplate: PresetTemplate = {
			...template,
			label: localizedPresetLabels.get(template.key) ?? template.label,
		};
		const success = await onCreatePresetFromTemplate(localizedTemplate, customIsShared, approvalOverride);
		if (success) {
			resetCustomForm();
		}
	};

	const handleLogTimed = async (): Promise<void> => {
		if (!canCreate) return;
		const success = await onLogTimed(customLabel, customBucket);
		if (success) {
			setCustomLabel("");
			setCustomBucket(defaultBucket);
			onClose();
		}
	};

	const startEdit = (preset: PresetSummary): void => {
		setEditingPresetId(preset.id);
		setEditLabel(preset.label);
		setEditBucket(preset.bucket);
		setEditApprovalOverride(preset.approvalOverride ?? "DEFAULT");
		setEditIsShared(preset.isShared);
	};

	const cancelEdit = (): void => {
		setEditingPresetId(null);
		setEditLabel("");
		setEditBucket(defaultBucket);
		setEditApprovalOverride("DEFAULT");
		setEditIsShared(true);
	};

	const handleUpdatePreset = async (event: SyntheticEvent<HTMLFormElement>, presetId: string): Promise<void> => {
		event.preventDefault();
		if (!canUpdate) return;
		const approvalOverride = resolveApprovalOverride(canEditApprovalOverride, editApprovalOverride);
		const success = await onUpdatePreset(presetId, editLabel, editBucket, editIsShared, approvalOverride);
		if (success) {
			setEditingPresetId(null);
		}
	};

	const handleDeletePreset = async (presetId: string): Promise<void> => {
		const success = await onDeletePreset(presetId);
		if (success && editingPresetId === presetId) {
			setEditingPresetId(null);
		}
	};

	return (
		<div className="fixed inset-0 z-40">
			<button
				type="button"
				className="absolute inset-0 bg-background/80 backdrop-blur-sm"
				onClick={onClose}
				aria-label={t("Close tasks editor")}
			/>
			<div
				role="dialog"
				aria-modal="true"
				aria-label={t("Tasks editor")}
				className="absolute right-0 top-0 h-full w-full border-l bg-background shadow-xl sm:max-w-md"
			>
				<div className="flex h-full flex-col">
					<div className="flex items-start justify-between gap-2 border-b px-6 py-5">
						<div className="space-y-1">
							<CardDescription>{t("Manage tasks")}</CardDescription>
							<CardTitle className="text-lg">{t("Add or edit tasks")}</CardTitle>
						</div>
						<Button type="button" variant="ghost" size="sm" onClick={onClose}>
							{t("Close")}
						</Button>
					</div>
					<div className="flex-1 space-y-6 overflow-y-auto px-4 py-4">
						<div className="space-y-3">
							<div className="space-y-3 rounded-lg border p-3">
								<p className="text-sm font-medium">{t("Add or log a one off chore")}</p>
								<div className="space-y-2">
									<Label htmlFor="custom-name">{t("Task name")}</Label>
									<Input
										id="custom-name"
										placeholder={t("Name your task")}
										value={customLabel}
										onChange={(e) => setCustomLabel(e.target.value)}
										disabled={disabled}
									/>
								</div>
								<div className="space-y-2">
									<p className="text-xs font-medium text-muted-foreground">{t("Bucket")}</p>
									<div className="grid grid-cols-2 gap-2 sm:grid-cols-3" role="radiogroup" aria-label={t("Bucket")}>
										{localizedBuckets.map((bucket) => {
											const isSelected = customBucket === bucket.key;
											return (
												<label
													key={bucket.key}
													className={cn(
														"flex w-full flex-col items-start rounded-lg border p-3 text-left transition",
														isSelected && "border-primary bg-primary/5",
														disabled ? "pointer-events-none opacity-50" : "hover:border-primary",
													)}
												>
													<input
														type="radio"
														name="custom-bucket"
														value={bucket.key}
														checked={isSelected}
														onChange={() => setCustomBucket(bucket.key)}
														className="sr-only"
														disabled={disabled}
													/>
													<span className="text-sm font-semibold">{bucket.label}</span>
													<span className="text-xs text-muted-foreground">
														{t("{{points}} pts · {{window}}", {
															points: bucket.points,
															window: BUCKET_WINDOW_SHORT[bucket.key],
														})}
													</span>
												</label>
											);
										})}
									</div>
								</div>

								{canEditApprovalOverride ? (
									<div className="space-y-2">
										<p className="text-xs font-medium text-muted-foreground">{t("Approval override")}</p>
										<Select
											value={customApprovalOverride}
											onValueChange={(value: "DEFAULT" | "REQUIRE" | "SKIP") => setCustomApprovalOverride(value)}
											disabled={disabled}
										>
											<SelectTrigger>
												<SelectValue placeholder={t("Use member default")} />
											</SelectTrigger>
											<SelectContent>
												<SelectItem value="DEFAULT">{t("Use member default")}</SelectItem>
												<SelectItem value="REQUIRE">{t("Require approval")}</SelectItem>
												<SelectItem value="SKIP">{t("Skip approval")}</SelectItem>
											</SelectContent>
										</Select>
									</div>
								) : null}
								{canManagePresets ? (
									<div className="space-y-2">
										<label className="flex items-center gap-2">
											<input
												type="checkbox"
												checked={customIsShared}
												onChange={(e) => setCustomIsShared(e.target.checked)}
												disabled={disabled}
												className="h-4 w-4"
											/>
											<span className="text-sm">{t("Share with household")}</span>
										</label>
										<p className="text-xs text-muted-foreground">
											{customIsShared
												? t("Everyone can see and use this task")
												: t("Only you can see and use this task")}
										</p>
									</div>
								) : null}
								<div className="grid gap-2 sm:grid-cols-2">
									<Button
										type="button"
										variant="secondary"
										className="h-auto min-h-9 w-full whitespace-normal px-3 py-2 text-center leading-tight"
										onClick={handleLogTimed}
										disabled={disabled || !canCreate}
									>
										{isPending ? <Loader2Icon className="mr-2 h-4 w-4 animate-spin" /> : null}
										{t("Log one off task")}
									</Button>
									{canManagePresets ? (
										<Button
											type="button"
											className="h-auto min-h-9 w-full whitespace-normal px-3 py-2 text-center leading-tight"
											onClick={handleCreatePreset}
											disabled={disabled || !canCreate}
										>
											{isPresetPending ? <Loader2Icon className="mr-2 h-4 w-4 animate-spin" /> : null}
											{t("Create new chore")}
										</Button>
									) : null}
								</div>
								{canManagePresets && templatesByBucket.length > 0 ? (
									<div className="space-y-2">
										<p className="text-xs font-medium text-muted-foreground">{t("Templates")}</p>
										<div className="flex flex-wrap gap-2">
											{templatesByBucket.flatMap(({ templates }) =>
												templates.map((template) => (
													<Button
														key={template.key}
														type="button"
														variant="outline"
														size="sm"
														className="rounded-full px-3"
														onClick={() => handleCreatePresetFromTemplate(template)}
														disabled={disabled}
													>
														{localizedPresetLabels.get(template.key) ?? template.label}
													</Button>
												)),
											)}
										</div>
									</div>
								) : null}
							</div>
							<div className="space-y-2">
								{sortedEditablePresets.length === 0 ? (
									<p className="text-xs text-muted-foreground">{t("No tasks yet")}</p>
								) : (
									sortedEditablePresets.map((preset) => (
										<PresetListItem
											key={preset.id}
											preset={preset}
											bucket={localizedBuckets.find((item) => item.key === preset.bucket)}
											isEditing={editingPresetId === preset.id}
											editLabel={editLabel}
											onEditLabelChange={setEditLabel}
											editBucket={editBucket}
											onEditBucketChange={setEditBucket}
											editApprovalOverride={editApprovalOverride}
											onEditApprovalOverrideChange={setEditApprovalOverride}
											editIsShared={editIsShared}
											onEditIsSharedChange={setEditIsShared}
											canUpdatePreset={canUpdate}
											onUpdatePreset={handleUpdatePreset}
											onCancelEdit={cancelEdit}
											onStartEdit={startEdit}
											onDeletePreset={handleDeletePreset}
											canDelete={preset.createdById === currentUserId}
											canEditApprovalOverride={canEditApprovalOverride}
											canManagePresets={canManagePresets}
											disabled={disabled}
										/>
									))
								)}
							</div>
						</div>
					</div>
				</div>
			</div>
		</div>
	);
}
