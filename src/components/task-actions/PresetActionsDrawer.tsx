import { Loader2Icon } from "lucide-react";
import type { FormEvent } from "react";
import { useEffect, useState } from "react";

import { PresetListItem } from "@/components/task-actions/PresetListItem";
import type { PresetSummary, PresetTemplate } from "@/components/task-actions/types";
import { Button } from "@/components/ui/Button";
import { CardDescription, CardTitle } from "@/components/ui/Card";
import { Input } from "@/components/ui/Input";
import { Label } from "@/components/ui/Label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/Select";
import type { DurationKey } from "@/lib/points";
import { DURATION_BUCKETS } from "@/lib/points";
import { cn } from "@/lib/utils";

const BUCKET_WINDOW_SHORT: Record<DurationKey, string> = {
	TINY: "<1m",
	QUICK: "1-5m",
	ROUTINE: "5-15m",
	CHALLENGING: "15-30m",
	HEAVY: "30-60m",
	MAJOR: "60-120m",
};

type TemplatesByBucket = Array<{
	bucket: (typeof DURATION_BUCKETS)[number];
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
		approvalOverride?: "REQUIRE" | "SKIP" | null,
	) => Promise<boolean>;
	onCreatePresetFromTemplate: (
		template: PresetTemplate,
		approvalOverride?: "REQUIRE" | "SKIP" | null,
	) => Promise<boolean>;
	onUpdatePreset: (
		presetId: string,
		label: string,
		bucket: DurationKey,
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
	const [customLabel, setCustomLabel] = useState("");
	const [customBucket, setCustomBucket] = useState<DurationKey>(defaultBucket);
	const [customApprovalOverride, setCustomApprovalOverride] = useState<"DEFAULT" | "REQUIRE" | "SKIP">("DEFAULT");
	const [editingPresetId, setEditingPresetId] = useState<string | null>(null);
	const [editLabel, setEditLabel] = useState("");
	const [editBucket, setEditBucket] = useState<DurationKey>(defaultBucket);
	const [editApprovalOverride, setEditApprovalOverride] = useState<"DEFAULT" | "REQUIRE" | "SKIP">("DEFAULT");

	useEffect(() => {
		if (!isOpen) {
			setCustomLabel("");
			setCustomBucket(defaultBucket);
			setCustomApprovalOverride("DEFAULT");
			setEditingPresetId(null);
			setEditLabel("");
			setEditBucket(defaultBucket);
			setEditApprovalOverride("DEFAULT");
		}
	}, [isOpen, defaultBucket]);

	const canCreate = customLabel.trim().length >= 2;
	const canLogTimed = canCreate;
	const canUpdate = editLabel.trim().length >= 2;

	if (!isOpen) return null;

	const handleCreatePreset = async () => {
		if (!canCreate) return;
		const approvalOverride = canEditApprovalOverride
			? customApprovalOverride === "DEFAULT"
				? null
				: customApprovalOverride
			: undefined;
		const success = await onCreatePreset(customLabel, customBucket, approvalOverride);
		if (success) {
			setCustomLabel("");
			setCustomBucket(defaultBucket);
			setCustomApprovalOverride("DEFAULT");
		}
	};

	const handleCreatePresetFromTemplate = async (template: PresetTemplate) => {
		const approvalOverride = canEditApprovalOverride
			? customApprovalOverride === "DEFAULT"
				? null
				: customApprovalOverride
			: undefined;
		const success = await onCreatePresetFromTemplate(template, approvalOverride);
		if (success) {
			setCustomLabel("");
			setCustomBucket(defaultBucket);
			setCustomApprovalOverride("DEFAULT");
		}
	};

	const handleLogTimed = async () => {
		if (!canLogTimed) return;
		const success = await onLogTimed(customLabel, customBucket);
		if (success) {
			setCustomLabel("");
			setCustomBucket(defaultBucket);
			onClose();
		}
	};

	const startEdit = (preset: PresetSummary) => {
		setEditingPresetId(preset.id);
		setEditLabel(preset.label);
		setEditBucket(preset.bucket);
		setEditApprovalOverride(preset.approvalOverride ?? "DEFAULT");
	};

	const cancelEdit = () => {
		setEditingPresetId(null);
		setEditLabel("");
		setEditBucket(defaultBucket);
		setEditApprovalOverride("DEFAULT");
	};

	const handleUpdatePreset = async (event: FormEvent<HTMLFormElement>, presetId: string) => {
		event.preventDefault();
		if (!canUpdate) return;
		const approvalOverride = canEditApprovalOverride
			? editApprovalOverride === "DEFAULT"
				? null
				: editApprovalOverride
			: undefined;
		const success = await onUpdatePreset(presetId, editLabel, editBucket, approvalOverride);
		if (success) {
			setEditingPresetId(null);
		}
	};

	const handleDeletePreset = async (presetId: string, label: string) => {
		const confirmed = window.confirm(`Delete the "${label}" preset? This cannot be undone.`);
		if (!confirmed) return;
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
				aria-label="Close tasks editor"
			/>
			<div
				role="dialog"
				aria-modal="true"
				aria-label="Tasks editor"
				className="absolute right-0 top-0 h-full w-full border-l bg-background shadow-xl sm:max-w-md"
			>
				<div className="flex h-full flex-col">
					<div className="flex items-start justify-between gap-2 border-b px-6 py-5">
						<div className="space-y-1">
							<CardDescription>Manage tasks</CardDescription>
							<CardTitle className="text-lg">Add or edit tasks</CardTitle>
						</div>
						<Button type="button" variant="ghost" size="sm" onClick={onClose}>
							Close
						</Button>
					</div>
					<div className="flex-1 space-y-6 overflow-y-auto px-4 py-4">
						<div className="space-y-3">
							<div className="space-y-3 rounded-lg border p-3">
								<p className="text-sm font-medium">Add or log a one off chore</p>
								<div className="space-y-2">
									<Label htmlFor="custom-name">Task name</Label>
									<Input
										id="custom-name"
										placeholder="Name your task"
										value={customLabel}
										onChange={(e) => setCustomLabel(e.target.value)}
										disabled={disabled}
									/>
								</div>
								<div className="space-y-2">
									<p className="text-xs font-medium text-muted-foreground">Bucket</p>
									<div className="grid grid-cols-2 gap-2 sm:grid-cols-3" role="radiogroup" aria-label="Bucket">
										{DURATION_BUCKETS.map((bucket) => {
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
														{bucket.points} pts · {BUCKET_WINDOW_SHORT[bucket.key]}
													</span>
												</label>
											);
										})}
									</div>
								</div>
								{canEditApprovalOverride ? (
									<div className="space-y-2">
										<p className="text-xs font-medium text-muted-foreground">Approval override</p>
										<Select
											value={customApprovalOverride}
											onValueChange={(value: "DEFAULT" | "REQUIRE" | "SKIP") => setCustomApprovalOverride(value)}
											disabled={disabled}
										>
											<SelectTrigger>
												<SelectValue placeholder="Use member default" />
											</SelectTrigger>
											<SelectContent>
												<SelectItem value="DEFAULT">Use member default</SelectItem>
												<SelectItem value="REQUIRE">Require approval</SelectItem>
												<SelectItem value="SKIP">Skip approval</SelectItem>
											</SelectContent>
										</Select>
									</div>
								) : null}
								<div className="grid gap-2 sm:grid-cols-2">
									<Button
										type="button"
										variant="secondary"
										className="w-full"
										onClick={handleLogTimed}
										disabled={disabled || !canLogTimed}
									>
										{isPending ? <Loader2Icon className="mr-2 h-4 w-4 animate-spin" /> : null}
										Log one off task
									</Button>
									{canManagePresets ? (
										<Button
											type="button"
											className="w-full"
											onClick={handleCreatePreset}
											disabled={disabled || !canCreate}
										>
											{isPresetPending ? <Loader2Icon className="mr-2 h-4 w-4 animate-spin" /> : null}
											Create new chore
										</Button>
									) : null}
								</div>
								{canManagePresets && templatesByBucket.length > 0 ? (
									<div className="space-y-2">
										<p className="text-xs font-medium text-muted-foreground">Templates</p>
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
														{template.label}
													</Button>
												)),
											)}
										</div>
									</div>
								) : null}
							</div>
							<div className="space-y-2">
								{sortedEditablePresets.length === 0 ? (
									<p className="text-xs text-muted-foreground">No tasks yet.</p>
								) : (
									sortedEditablePresets.map((preset) => (
										<PresetListItem
											key={preset.id}
											preset={preset}
											bucket={DURATION_BUCKETS.find((item) => item.key === preset.bucket)}
											isEditing={editingPresetId === preset.id}
											editLabel={editLabel}
											onEditLabelChange={setEditLabel}
											editBucket={editBucket}
											onEditBucketChange={setEditBucket}
											editApprovalOverride={editApprovalOverride}
											onEditApprovalOverrideChange={setEditApprovalOverride}
											canUpdatePreset={canUpdate}
											onUpdatePreset={handleUpdatePreset}
											onCancelEdit={cancelEdit}
											onStartEdit={startEdit}
											onDeletePreset={handleDeletePreset}
											canDelete={preset.createdById === currentUserId}
											canEditApprovalOverride={canEditApprovalOverride}
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
