"use client";

import { Loader2Icon } from "lucide-react";
import { useRouter } from "next/navigation";
import { type SyntheticEvent, useEffect, useMemo, useState } from "react";

import {
	type ApprovalOverrideOption,
	PresetApprovalOverrideSelect,
	PresetBucketSelect,
	resolveApprovalOverride,
} from "@/components/task-actions/PresetFormFields";
import { PresetIconPicker } from "@/components/task-actions/PresetIconPicker";
import type { PresetSummary } from "@/components/task-actions/types";
import { Button } from "@/components/ui/Button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/Card";
import { Input } from "@/components/ui/Input";
import { Label } from "@/components/ui/Label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/Select";
import { Switch } from "@/components/ui/Switch";
import { useToast } from "@/hooks/useToast";
import {
	CADENCE_NONE_VALUE,
	CADENCE_OPTIONS,
	DEFAULT_CADENCE_INTERVAL_MINUTES,
	DEFAULT_CADENCE_TARGET,
} from "@/lib/assignedTasksCadence";
import { mapPresetSummaries } from "@/lib/dashboard/presets";
import { useTranslation } from "@/lib/i18nClient";
import { DEFAULT_DURATION_BUCKET, type DurationKey } from "@/lib/points";
import type { PresetIconKey } from "@/lib/presetIcons";
import { PRESET_LABEL_MIN_LENGTH } from "@/lib/presetInput";
import { trpc } from "@/lib/trpc/react";

const UNASSIGNED_VALUE = "unassigned";
const NEW_PRESET_VALUE = "__new__";

type MemberOption = {
	id: string;
	name: string | null;
	email: string | null;
};

type AssignTaskCardProps = {
	householdId: string;
	members: MemberOption[];
	presets: PresetSummary[];
	currentUserId: string;
};

export const AssignTaskCard = ({ householdId, members, presets, currentUserId }: AssignTaskCardProps) => {
	const router = useRouter();
	const { toast } = useToast();
	const { t } = useTranslation();

	const sortedMembers = useMemo(
		() => [...members].sort((a, b) => (a.name ?? a.email ?? "").localeCompare(b.name ?? b.email ?? "")),
		[members],
	);
	// Presets created inline stay selectable until the refreshed server props include them.
	const [createdPresets, setCreatedPresets] = useState<PresetSummary[]>([]);
	const sortedPresets = useMemo(() => {
		const knownIds = new Set(presets.map((preset) => preset.id));
		return [...presets, ...createdPresets.filter((preset) => !knownIds.has(preset.id))]
			.filter((preset) => preset.isShared)
			.sort((a, b) => a.label.localeCompare(b.label));
	}, [createdPresets, presets]);

	const [assigneeId, setAssigneeId] = useState(currentUserId);
	const [presetId, setPresetId] = useState(sortedPresets[0]?.id ?? NEW_PRESET_VALUE);
	const [newLabel, setNewLabel] = useState("");
	const [newBucket, setNewBucket] = useState<DurationKey>(DEFAULT_DURATION_BUCKET);
	const [newIconKey, setNewIconKey] = useState<PresetIconKey | null>(null);
	const [newApprovalOverride, setNewApprovalOverride] = useState<ApprovalOverrideOption>("DEFAULT");
	const [cadenceTarget, setCadenceTarget] = useState(DEFAULT_CADENCE_TARGET);
	const [cadenceInterval, setCadenceInterval] = useState(String(DEFAULT_CADENCE_INTERVAL_MINUTES));
	const [isRecurring, setIsRecurring] = useState(true);

	useEffect(() => {
		if (presetId !== NEW_PRESET_VALUE && !sortedPresets.find((preset) => preset.id === presetId)) {
			setPresetId(sortedPresets[0]?.id ?? NEW_PRESET_VALUE);
		}
	}, [presetId, sortedPresets]);

	useEffect(() => {
		if (assigneeId !== UNASSIGNED_VALUE && !sortedMembers.find((member) => member.id === assigneeId)) {
			setAssigneeId(sortedMembers[0]?.id ?? currentUserId);
		}
	}, [assigneeId, currentUserId, sortedMembers]);

	const createMutation = trpc.assignedTasks.create.useMutation({
		onSuccess: () => {
			toast({
				title: t("Task added"),
				description: t("The task is now in the queue."),
			});
			router.refresh();
		},
		onError: (error) => {
			toast({
				title: t("Unable to add task"),
				description: error.message ?? t("Please try again."),
				variant: "destructive",
			});
		},
	});

	const utils = trpc.useUtils();
	const createWithPresetMutation = trpc.assignedTasks.createWithPreset.useMutation({
		onSuccess: ({ preset }) => {
			const [summary] = mapPresetSummaries([preset]);
			setCreatedPresets((prev) => [...prev, summary]);
			setPresetId(summary.id);
			setNewLabel("");
			setNewBucket(DEFAULT_DURATION_BUCKET);
			setNewIconKey(null);
			setNewApprovalOverride("DEFAULT");
			toast({
				title: t("Task added"),
				description: t("{{label}} was created and added to the queue.", { label: summary.label }),
				variant: "success",
			});
			void utils.presets.invalidate();
			router.refresh();
		},
		onError: (error) => {
			toast({
				title: t("Unable to add task"),
				description: error.message ?? t("Please try again."),
				variant: "destructive",
			});
		},
	});

	const isCreatingPreset = presetId === NEW_PRESET_VALUE;

	// Radix's hidden native select reports "" when the value and its newly added option arrive in the same render.
	const handlePresetChange = (value: string) => {
		if (value) {
			setPresetId(value);
		}
	};

	const handleSubmit = (event: SyntheticEvent<HTMLFormElement>) => {
		event.preventDefault();
		if (!presetId) {
			toast({
				title: t("Missing details"),
				description: t("Pick a task to add."),
				variant: "destructive",
			});
			return;
		}
		const trimmedLabel = newLabel.trim();
		if (isCreatingPreset && trimmedLabel.length < PRESET_LABEL_MIN_LENGTH) {
			toast({
				title: t("Missing details"),
				description: t("Name the new task (at least {{min}} characters).", { min: PRESET_LABEL_MIN_LENGTH }),
				variant: "destructive",
			});
			return;
		}

		const cadenceTargetValue = isRecurring ? Math.max(1, Math.floor(cadenceTarget || 1)) : DEFAULT_CADENCE_TARGET;
		const cadenceIntervalMinutes = isRecurring
			? Math.max(1, Number.parseInt(cadenceInterval, 10) || 1)
			: DEFAULT_CADENCE_INTERVAL_MINUTES;

		const assignment = {
			householdId,
			assigneeId: assigneeId === UNASSIGNED_VALUE ? null : assigneeId,
			cadenceTarget: cadenceTargetValue,
			cadenceIntervalMinutes,
			isRecurring,
		};

		if (isCreatingPreset) {
			createWithPresetMutation.mutate({
				...assignment,
				preset: {
					label: trimmedLabel,
					bucket: newBucket,
					iconKey: newIconKey,
					approvalOverride: resolveApprovalOverride(true, newApprovalOverride),
				},
			});
			return;
		}

		createMutation.mutate({ ...assignment, presetId });
	};

	const disabled = createMutation.isPending || createWithPresetMutation.isPending;

	return (
		<Card>
			<CardHeader>
				<CardTitle className="text-xl">{t("Add task")}</CardTitle>
				<CardDescription>{t("Pick an existing shared task or create a new one.")}</CardDescription>
			</CardHeader>
			<CardContent>
				<form className="grid gap-4" onSubmit={handleSubmit}>
					<div className="grid gap-4 md:grid-cols-2">
						<div className="grid gap-2">
							<Label htmlFor="assignee">{t("Assignee")}</Label>
							<Select value={assigneeId} onValueChange={setAssigneeId} disabled={disabled}>
								<SelectTrigger id="assignee">
									<SelectValue placeholder={t("Select member")} />
								</SelectTrigger>
								<SelectContent>
									<SelectItem value={UNASSIGNED_VALUE}>{t("Open")}</SelectItem>
									{sortedMembers.map((member) => (
										<SelectItem key={member.id} value={member.id}>
											{member.name ?? member.email ?? t("Unknown")}
										</SelectItem>
									))}
								</SelectContent>
							</Select>
						</div>
						<div className="grid gap-2">
							<Label htmlFor="preset">{t("Task")}</Label>
							<Select value={presetId} onValueChange={handlePresetChange} disabled={disabled}>
								<SelectTrigger id="preset">
									<SelectValue placeholder={t("Select task")} />
								</SelectTrigger>
								<SelectContent>
									{sortedPresets.map((preset) => (
										<SelectItem key={preset.id} value={preset.id}>
											{preset.label}
										</SelectItem>
									))}
									<SelectItem value={NEW_PRESET_VALUE}>{t("New task…")}</SelectItem>
								</SelectContent>
							</Select>
						</div>
					</div>
					{isCreatingPreset ? (
						<fieldset className="grid gap-4 rounded-md border border-input p-3 md:grid-cols-2">
							<legend className="px-1 text-sm font-medium">{t("New shared task")}</legend>
							<p className="text-xs text-muted-foreground md:col-span-2">
								{t("Everyone in the household can see and use this task.")}
							</p>
							<div className="grid gap-2 md:col-span-2">
								<Label htmlFor="new-preset-label">{t("Task name")}</Label>
								<Input
									id="new-preset-label"
									placeholder={t("Name your task")}
									value={newLabel}
									maxLength={50}
									onChange={(event) => setNewLabel(event.target.value)}
									disabled={disabled}
								/>
							</div>
							<div className="grid gap-2">
								<Label htmlFor="new-preset-bucket">{t("Bucket")}</Label>
								<PresetBucketSelect
									id="new-preset-bucket"
									value={newBucket}
									onChange={setNewBucket}
									disabled={disabled}
								/>
							</div>
							<div className="grid gap-2">
								<Label htmlFor="new-preset-icon">{t("Icon")}</Label>
								<PresetIconPicker
									id="new-preset-icon"
									value={newIconKey}
									onChange={setNewIconKey}
									disabled={disabled}
									placeholder={t("Pick an icon")}
									searchPlaceholder={t("Search icons...")}
									noneLabel={t("No icon")}
									noResultsLabel={t("No icon found.")}
								/>
							</div>
							<div className="grid gap-2 md:col-span-2">
								<Label htmlFor="new-preset-approval">{t("Approval override")}</Label>
								<PresetApprovalOverrideSelect
									id="new-preset-approval"
									value={newApprovalOverride}
									onChange={setNewApprovalOverride}
									disabled={disabled}
								/>
							</div>
						</fieldset>
					) : null}
					<div className="grid gap-4 md:grid-cols-2">
						<div className="flex items-center justify-between gap-2 rounded-md border border-input px-3 py-2 md:col-span-2">
							<div className="space-y-1">
								<Label htmlFor="recurring">{t("Recurring")}</Label>
								<p className="text-xs text-muted-foreground">{t("Reset after each cadence cycle.")}</p>
							</div>
							<Switch
								id="recurring"
								checked={isRecurring}
								onCheckedChange={(value) => {
									setIsRecurring(value);
									if (!value) {
										setCadenceTarget(DEFAULT_CADENCE_TARGET);
										setCadenceInterval(String(DEFAULT_CADENCE_INTERVAL_MINUTES));
									}
								}}
								disabled={disabled}
							/>
						</div>
						{isRecurring ? (
							<>
								<div className="grid gap-2">
									<Label htmlFor="cadence-interval">{t("Cadence")}</Label>
									<Select
										value={cadenceInterval}
										onValueChange={(value) => {
											if (value === CADENCE_NONE_VALUE) {
												setIsRecurring(false);
												setCadenceTarget(DEFAULT_CADENCE_TARGET);
												setCadenceInterval(String(DEFAULT_CADENCE_INTERVAL_MINUTES));
												return;
											}
											setCadenceInterval(value);
										}}
										disabled={disabled}
									>
										<SelectTrigger id="cadence-interval">
											<SelectValue placeholder={t("Select cadence")} />
										</SelectTrigger>
										<SelectContent>
											{CADENCE_OPTIONS.map((option) => (
												<SelectItem key={option.value} value={option.value}>
													{option.label}
												</SelectItem>
											))}
										</SelectContent>
									</Select>
								</div>
								<div className="grid gap-2">
									<Label htmlFor="cadence-target">{t("Completions per cycle")}</Label>
									<Input
										id="cadence-target"
										type="number"
										min={1}
										value={cadenceTarget}
										onChange={(event) => setCadenceTarget(Number.parseInt(event.target.value, 10) || 1)}
										disabled={disabled}
									/>
								</div>
							</>
						) : null}
					</div>
					<Button type="submit" disabled={disabled}>
						{disabled ? <Loader2Icon className="mr-2 h-4 w-4 animate-spin" /> : null}
						{t("Add task")}
					</Button>
				</form>
			</CardContent>
		</Card>
	);
};
