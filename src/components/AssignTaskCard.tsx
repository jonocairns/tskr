"use client";

import { CheckIcon, Loader2Icon, TriangleAlertIcon } from "lucide-react";
import { useRouter } from "next/navigation";
import { type SyntheticEvent, useEffect, useMemo, useRef, useState } from "react";

import {
	type ApprovalOverrideOption,
	PresetApprovalOverrideSelect,
	PresetBucketSelect,
	resolveApprovalOverride,
} from "@/components/task-actions/PresetFormFields";
import { PresetIconPicker } from "@/components/task-actions/PresetIconPicker";
import { PresetIconGlyph } from "@/components/task-actions/presetIcons";
import type { PresetSummary } from "@/components/task-actions/types";
import { Button } from "@/components/ui/Button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/Card";
import { Input } from "@/components/ui/Input";
import { Label } from "@/components/ui/Label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/Select";
import { useToast } from "@/hooks/useToast";
import {
	CADENCE_NONE_VALUE,
	CADENCE_OPTIONS,
	DEFAULT_CADENCE_INTERVAL_MINUTES,
	DEFAULT_CADENCE_TARGET,
	formatCadenceOption,
	formatCadenceTargetLabel,
} from "@/lib/assignedTasksCadence";
import { mapPresetSummaries } from "@/lib/dashboard/presets";
import { useTranslation } from "@/lib/i18nClient";
import { DEFAULT_DURATION_BUCKET, type DurationKey, getLocalizedDurationBuckets } from "@/lib/points";
import type { PresetIconKey } from "@/lib/presetIcons";
import { PRESET_LABEL_MIN_LENGTH } from "@/lib/presetInput";
import { type DuplicateTask, findDuplicateTask } from "@/lib/tasks/duplicates";
import { trpc } from "@/lib/trpc/react";
import { cn } from "@/lib/utils";

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
	existingTasks: DuplicateTask[];
	currentUserId: string;
	onTaskAdded?: (assignedTaskId: string) => void;
	onViewTask?: (assignedTaskId: string) => void;
};

const ADDED_CONFIRMATION_MS = 1500;

export const AssignTaskCard = ({
	householdId,
	members,
	presets,
	currentUserId,
	existingTasks,
	onTaskAdded,
	onViewTask,
}: AssignTaskCardProps) => {
	const router = useRouter();
	const { toast } = useToast();
	const { t } = useTranslation();

	const [hydrated, setHydrated] = useState(false);
	useEffect(() => setHydrated(true), []);

	const sortedMembers = useMemo(
		() => [...members].sort((a, b) => (a.name ?? a.email ?? "").localeCompare(b.name ?? b.email ?? "")),
		[members],
	);
	// Presets created inline stay selectable until the refreshed server props include them.
	const [createdPresets, setCreatedPresets] = useState<PresetSummary[]>([]);
	useEffect(() => {
		const knownIds = new Set(presets.map((preset) => preset.id));
		setCreatedPresets((previous) => {
			const remaining = previous.filter((preset) => !knownIds.has(preset.id));
			return remaining.length === previous.length ? previous : remaining;
		});
	}, [presets]);
	const sortedPresets = useMemo(() => {
		const knownIds = new Set(presets.map((preset) => preset.id));
		return [...presets, ...createdPresets.filter((preset) => !knownIds.has(preset.id))]
			.filter((preset) => preset.isShared)
			.sort((a, b) => a.label.localeCompare(b.label));
	}, [createdPresets, presets]);

	const [assigneeId, setAssigneeId] = useState(currentUserId);
	const [presetId, setPresetId] = useState(NEW_PRESET_VALUE);
	const [newLabel, setNewLabel] = useState("");
	const [newBucket, setNewBucket] = useState<DurationKey>(DEFAULT_DURATION_BUCKET);
	const [newIconKey, setNewIconKey] = useState<PresetIconKey | null>(null);
	const [newApprovalOverride, setNewApprovalOverride] = useState<ApprovalOverrideOption>("DEFAULT");
	const [cadenceTarget, setCadenceTarget] = useState(DEFAULT_CADENCE_TARGET);
	const [cadenceInterval, setCadenceInterval] = useState(String(DEFAULT_CADENCE_INTERVAL_MINUTES));
	const [isRecurring, setIsRecurring] = useState(true);
	const [justAdded, setJustAdded] = useState(false);
	const [added, setAdded] = useState<{ id: string; label: string } | null>(null);
	// Bumped on every add so confirmation timers restart when tasks are added in quick succession.
	const [addCount, setAddCount] = useState(0);
	const [nameError, setNameError] = useState<string | null>(null);
	const [focusTarget, setFocusTarget] = useState<"name" | "submit" | null>(null);
	const formRef = useRef<HTMLFormElement>(null);
	const nameInputRef = useRef<HTMLInputElement>(null);
	const submitRef = useRef<HTMLButtonElement>(null);

	useEffect(() => {
		if (addCount === 0) {
			return;
		}
		// The status line (with its View action) has no timeout: it stays until the next edit, so it can't
		// disappear while someone is reaching it.
		const confirmation = setTimeout(() => setJustAdded(false), ADDED_CONFIRMATION_MS);
		return () => clearTimeout(confirmation);
	}, [addCount]);

	// Any edit starts the next task, so the previous confirmation no longer applies.
	const markEdited = () => setAdded(null);

	// The assignee stays put so several tasks can be added for the same person in a row.
	const resetAfterAdd = (assignedTaskId: string, label: string) => {
		setPresetId(NEW_PRESET_VALUE);
		setNewLabel("");
		setNewBucket(DEFAULT_DURATION_BUCKET);
		setNewIconKey(null);
		setNewApprovalOverride("DEFAULT");
		setIsRecurring(true);
		setCadenceTarget(DEFAULT_CADENCE_TARGET);
		setCadenceInterval(String(DEFAULT_CADENCE_INTERVAL_MINUTES));
		setNameError(null);
		setJustAdded(true);
		setAdded({ id: assignedTaskId, label });
		setAddCount((count) => count + 1);
		setFocusTarget("name");
		onTaskAdded?.(assignedTaskId);
	};

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
		onSuccess: ({ assignedTask }, { presetId: addedPresetId }) => {
			const label = sortedPresets.find((preset) => preset.id === addedPresetId)?.label ?? t("Task");
			resetAfterAdd(assignedTask.id, label);
			router.refresh();
		},
		onError: (error) => {
			setFocusTarget("submit");
			toast({
				title: t("Unable to add task"),
				description: error.message ?? t("Please try again."),
				variant: "destructive",
			});
		},
	});

	const utils = trpc.useUtils();
	const createWithPresetMutation = trpc.assignedTasks.createWithPreset.useMutation({
		onSuccess: ({ preset, assignedTask }) => {
			const [summary] = mapPresetSummaries([preset]);
			setCreatedPresets((prev) => [...prev, summary]);
			resetAfterAdd(assignedTask.id, summary.label);
			void utils.presets.invalidate();
			router.refresh();
		},
		onError: (error) => {
			setFocusTarget("submit");
			toast({
				title: t("Unable to add task"),
				description: error.message ?? t("Please try again."),
				variant: "destructive",
			});
		},
	});

	const isCreatingPreset = presetId === NEW_PRESET_VALUE;
	const duplicate = findDuplicateTask({
		tasks: existingTasks,
		presetId: isCreatingPreset ? null : presetId,
		label: newLabel,
		assigneeId: assigneeId === UNASSIGNED_VALUE ? null : assigneeId,
	});
	const assignee = members.find((member) => member.id === assigneeId);
	const selectedPreset = isCreatingPreset ? null : sortedPresets.find((preset) => preset.id === presetId);
	const bucketOptions = useMemo(() => getLocalizedDurationBuckets(t), [t]);
	const selectedBucket = bucketOptions.find((bucket) => bucket.key === selectedPreset?.bucket);
	const approvalSummary =
		selectedPreset?.approvalOverride === "REQUIRE"
			? t("Needs approval")
			: selectedPreset?.approvalOverride === "SKIP"
				? t("No approval needed")
				: t("Uses the completer's approval setting");
	const cadenceIntervalMinutes = Number.parseInt(cadenceInterval, 10) || DEFAULT_CADENCE_INTERVAL_MINUTES;

	// Radix's hidden native select reports "" when the value and its newly added option arrive in the same render.
	const handlePresetChange = (value: string) => {
		if (value) {
			setPresetId(value);
			setNameError(null);
			markEdited();
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
			setNameError(t("Name the new task (at least {{min}} characters).", { min: PRESET_LABEL_MIN_LENGTH }));
			markEdited();
			nameInputRef.current?.focus();
			return;
		}

		const cadenceTargetValue = isRecurring ? Math.max(1, Math.floor(cadenceTarget || 1)) : DEFAULT_CADENCE_TARGET;
		const assignment = {
			householdId,
			assigneeId: assigneeId === UNASSIGNED_VALUE ? null : assigneeId,
			cadenceTarget: cadenceTargetValue,
			cadenceIntervalMinutes: isRecurring ? Math.max(1, cadenceIntervalMinutes) : DEFAULT_CADENCE_INTERVAL_MINUTES,
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

	const disabled = !hydrated || createMutation.isPending || createWithPresetMutation.isPending;

	// Inputs stay disabled until the mutation settles, so focus waits for them to re-enable. Focus only
	// moves if it was lost to the disabled controls, not if the user has since moved elsewhere.
	useEffect(() => {
		if (!focusTarget || disabled) {
			return;
		}
		const active = document.activeElement;
		if (!active || active === document.body || formRef.current?.contains(active)) {
			(focusTarget === "name" ? nameInputRef.current : submitRef.current)?.focus({ preventScroll: true });
		}
		setFocusTarget(null);
	}, [disabled, focusTarget]);

	return (
		<Card>
			<CardHeader>
				<CardTitle className="text-xl">{t("Add task")}</CardTitle>
			</CardHeader>
			<CardContent>
				<form ref={formRef} className="grid gap-6" onSubmit={handleSubmit} noValidate>
					<div className="grid gap-4">
						<div className="grid content-start gap-2">
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
							{selectedPreset ? (
								<p className="flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-muted-foreground">
									<PresetIconGlyph iconKey={selectedPreset.iconKey} className="h-3.5 w-3.5" />
									<span>
										{selectedBucket ? `${selectedBucket.label} (${selectedBucket.points} pts)` : selectedPreset.bucket}
									</span>
									<span aria-hidden="true">·</span>
									<span>{approvalSummary}</span>
								</p>
							) : null}
						</div>
						{isCreatingPreset ? (
							<div className="grid gap-4 md:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_9rem]">
								<div className="grid content-start gap-2 md:col-span-3">
									<Label htmlFor="new-preset-label">{t("Task name")}</Label>
									<div className="flex gap-2">
										<PresetIconPicker
											id="new-preset-icon"
											compact
											aria-label={t("Icon")}
											value={newIconKey}
											onChange={(value) => {
												setNewIconKey(value);
												markEdited();
											}}
											disabled={disabled}
											placeholder={t("Pick an icon")}
											searchPlaceholder={t("Search icons...")}
											noneLabel={t("No icon")}
											noResultsLabel={t("No icon found.")}
										/>
										<Input
											id="new-preset-label"
											ref={nameInputRef}
											className="flex-1"
											placeholder={t("e.g. Water the plants")}
											value={newLabel}
											maxLength={50}
											aria-invalid={nameError ? true : undefined}
											aria-describedby={nameError ? "new-preset-label-error" : "new-preset-label-hint"}
											onChange={(event) => {
												setNewLabel(event.target.value);
												setNameError(null);
												markEdited();
											}}
											disabled={disabled}
										/>
									</div>
									{nameError ? (
										<p id="new-preset-label-error" role="alert" className="text-sm text-red-700 dark:text-red-400">
											{nameError}
										</p>
									) : (
										<p id="new-preset-label-hint" className="text-xs text-muted-foreground">
											{t("Everyone in the household can see and use this task.")}
										</p>
									)}
								</div>
								<div className="grid content-start gap-2">
									<Label htmlFor="new-preset-bucket">{t("Points")}</Label>
									<PresetBucketSelect
										id="new-preset-bucket"
										value={newBucket}
										onChange={(value) => {
											setNewBucket(value);
											markEdited();
										}}
										disabled={disabled}
									/>
								</div>
								<div className="grid content-start gap-2 md:col-span-2">
									<Label htmlFor="new-preset-approval">{t("Approval")}</Label>
									<PresetApprovalOverrideSelect
										id="new-preset-approval"
										value={newApprovalOverride}
										onChange={(value) => {
											setNewApprovalOverride(value);
											markEdited();
										}}
										disabled={disabled}
									/>
								</div>
							</div>
						) : null}
					</div>
					<div className="grid grid-cols-[minmax(0,1fr)_7rem] gap-4 border-t pt-6 md:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_9rem]">
						<div className="col-span-2 grid content-start gap-2 md:col-span-1">
							<Label htmlFor="assignee">{t("Assignee")}</Label>
							<Select
								value={assigneeId}
								onValueChange={(value) => {
									setAssigneeId(value);
									markEdited();
								}}
								disabled={disabled}
							>
								<SelectTrigger id="assignee">
									<SelectValue placeholder={t("Select member")} />
								</SelectTrigger>
								<SelectContent>
									<SelectItem value={UNASSIGNED_VALUE}>{t("Open – anyone can do it")}</SelectItem>
									{sortedMembers.map((member) => (
										<SelectItem key={member.id} value={member.id}>
											{member.name ?? member.email ?? t("Unknown")}
										</SelectItem>
									))}
								</SelectContent>
							</Select>
						</div>
						<div className={cn("grid content-start gap-2", !isRecurring && "col-span-2 md:col-span-1")}>
							<Label htmlFor="cadence-interval">{t("Repeats")}</Label>
							<Select
								value={isRecurring ? cadenceInterval : CADENCE_NONE_VALUE}
								onValueChange={(value) => {
									if (!value) {
										return;
									}
									markEdited();
									if (value === CADENCE_NONE_VALUE) {
										setIsRecurring(false);
										return;
									}
									setIsRecurring(true);
									setCadenceInterval(value);
								}}
								disabled={disabled}
							>
								<SelectTrigger id="cadence-interval">
									<SelectValue placeholder={t("Select repeat interval")} />
								</SelectTrigger>
								<SelectContent>
									{CADENCE_OPTIONS.map((option) => (
										<SelectItem key={option.value} value={option.value}>
											{formatCadenceOption(option.value, t)}
										</SelectItem>
									))}
								</SelectContent>
							</Select>
							{isRecurring ? null : (
								<p className="text-xs text-muted-foreground">{t("Stays on the list until it's done once.")}</p>
							)}
						</div>
						{isRecurring ? (
							<div className="grid content-start gap-2">
								<Label htmlFor="cadence-target">{formatCadenceTargetLabel(cadenceIntervalMinutes, t)}</Label>
								<Input
									id="cadence-target"
									type="number"
									inputMode="numeric"
									min={1}
									value={cadenceTarget || ""}
									onChange={(event) => {
										// Empty while retyping; clamped on blur and submit.
										setCadenceTarget(Number.parseInt(event.target.value, 10) || 0);
										markEdited();
									}}
									onBlur={() => setCadenceTarget((value) => Math.max(1, value || 1))}
									disabled={disabled}
								/>
							</div>
						) : null}
					</div>
					{duplicate ? (
						<p role="status" className="flex items-start gap-1.5 text-sm text-amber-700 dark:text-amber-400">
							<TriangleAlertIcon className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
							{duplicate.assigneeId === null
								? t("{{task}} is already on the list as Open. Adding it again creates a second copy.", {
										task: duplicate.presetLabel,
									})
								: t("{{task}} is already on the list for {{name}}. Adding it again creates a second copy.", {
										task: duplicate.presetLabel,
										name: assignee?.name ?? assignee?.email ?? t("Unknown"),
									})}
						</p>
					) : null}
					<div className="flex flex-col sm:flex-row sm:items-center sm:justify-end sm:gap-3">
						<p
							role="status"
							aria-live="polite"
							className="pb-3 text-sm text-muted-foreground empty:pb-0 sm:mr-auto sm:min-h-5 sm:pb-0"
						>
							{added ? (
								<span className="inline-flex flex-wrap items-center gap-x-1.5">
									<CheckIcon className="h-4 w-4 text-emerald-600" aria-hidden="true" />
									{t("{{label}} added to All tasks.", { label: added.label })}
									{onViewTask ? (
										<button
											type="button"
											className="rounded-sm font-medium text-foreground underline-offset-4 hover:underline focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
											onClick={() => onViewTask(added.id)}
										>
											{t("View")}
										</button>
									) : null}
								</span>
							) : null}
						</p>
						<Button ref={submitRef} type="submit" disabled={disabled} className="w-full sm:w-auto sm:min-w-36">
							{disabled ? (
								<Loader2Icon className="mr-2 h-4 w-4 animate-spin" />
							) : justAdded ? (
								<CheckIcon className="mr-2 h-4 w-4" />
							) : null}
							{justAdded && !disabled ? t("Added") : t("Add task")}
						</Button>
					</div>
				</form>
			</CardContent>
		</Card>
	);
};
