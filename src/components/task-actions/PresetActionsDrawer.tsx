import { closestCenter, DndContext } from "@dnd-kit/core";
import { rectSortingStrategy, SortableContext, useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { Loader2Icon, PlusIcon } from "lucide-react";
import type { ReactNode, SyntheticEvent } from "react";
import { useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";

import { PresetIconPicker } from "@/components/task-actions/PresetIconPicker";
import { PresetListItem } from "@/components/task-actions/PresetListItem";
import { TaskButton } from "@/components/task-actions/TaskButton";
import { TaskSearchBar } from "@/components/task-actions/TaskSearchBar";
import type { PresetSummary, PresetTemplate } from "@/components/task-actions/types";
import { usePresetReorder } from "@/components/task-actions/usePresetReorder";
import { BUCKET_WINDOW_SHORT, normalizeText } from "@/components/task-actions/utils";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Label } from "@/components/ui/Label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/Select";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/Tabs";
import { useTranslation } from "@/lib/i18nClient";
import type { DurationKey } from "@/lib/points";
import { getLocalizedDurationBuckets, getLocalizedPresetTasks } from "@/lib/points";
import type { PresetIconKey } from "@/lib/presetIcons";
import { cn } from "@/lib/utils";

type ApprovalOverrideOption = "DEFAULT" | "REQUIRE" | "SKIP";
type TaskCreateMode = "preset" | "one-off";

type TemplatesByBucket = Array<{
	bucket: ReturnType<typeof getLocalizedDurationBuckets>[number];
	templates: PresetTemplate[];
}>;

type Props = {
	defaultBucket: DurationKey;
	onLogTimed?: (label: string, bucket: DurationKey) => Promise<boolean>;
	onCreatePreset: (
		label: string,
		bucket: DurationKey,
		isShared: boolean,
		approvalOverride?: "REQUIRE" | "SKIP" | null,
		iconKey?: PresetIconKey | null,
	) => Promise<boolean>;
	onCreatePresetFromTemplate: (
		template: PresetTemplate,
		isShared: boolean,
		approvalOverride?: "REQUIRE" | "SKIP" | null,
		iconKey?: PresetIconKey | null,
	) => Promise<boolean>;
	onUpdatePreset: (
		presetId: string,
		label: string,
		bucket: DurationKey,
		isShared: boolean,
		approvalOverride?: "REQUIRE" | "SKIP" | null,
		iconKey?: PresetIconKey | null,
	) => Promise<boolean>;
	onDeletePreset: (presetId: string) => Promise<boolean>;
	onReorderPresets?: (orderedPresetIds: string[]) => Promise<boolean>;
	templatesByBucket: TemplatesByBucket;
	disabled: boolean;
	isPending: boolean;
	isPresetPending: boolean;
	sortedEditablePresets: PresetSummary[];
	presetDisplayLabels: Map<string, string>;
	currentUserId: string;
	canEditApprovalOverride: boolean;
	canManagePresets: boolean;
	allowOneOffMode?: boolean;
	showPresetList?: boolean;
	showListHeader?: boolean;
	onLogTimedSuccess?: () => void;
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

type SortableGridItemProps = {
	id: string;
	disabled: boolean;
	isActive: boolean;
	children: ReactNode;
};

const SortableGridItem = ({ id, disabled, isActive, children }: SortableGridItemProps) => {
	const { attributes, listeners, setNodeRef, transform, transition } = useSortable({ id, disabled });

	return (
		<div
			ref={setNodeRef}
			style={{
				transform: CSS.Transform.toString(transform),
				transition,
			}}
			className={cn(
				"touch-none",
				disabled ? null : "cursor-grab select-none active:cursor-grabbing",
				isActive ? "z-10 scale-[1.01] shadow-lg" : null,
			)}
			{...attributes}
			{...listeners}
		>
			{children}
		</div>
	);
};

export const PresetActionsDrawer = ({
	defaultBucket,
	onLogTimed,
	onCreatePreset,
	onCreatePresetFromTemplate,
	onUpdatePreset,
	onDeletePreset,
	onReorderPresets,
	templatesByBucket,
	disabled,
	isPending,
	isPresetPending,
	sortedEditablePresets,
	presetDisplayLabels,
	currentUserId,
	canEditApprovalOverride,
	canManagePresets,
	allowOneOffMode = true,
	showPresetList = true,
	showListHeader = true,
	onLogTimedSuccess,
}: Props) => {
	const { t } = useTranslation();
	const localizedBuckets = useMemo(() => getLocalizedDurationBuckets(t), [t]);
	const localizedPresetLabels = useMemo(() => {
		return new Map(getLocalizedPresetTasks(t).map((task) => [task.key, task.label]));
	}, [t]);
	const [customLabel, setCustomLabel] = useState("");
	const [customBucket, setCustomBucket] = useState<DurationKey>(defaultBucket);
	const [customApprovalOverride, setCustomApprovalOverride] = useState<ApprovalOverrideOption>("DEFAULT");
	const [customIsShared, setCustomIsShared] = useState(true);
	const [customIconKey, setCustomIconKey] = useState<PresetIconKey | null>(null);
	const [taskCreateMode, setTaskCreateMode] = useState<TaskCreateMode>(canManagePresets ? "preset" : "one-off");
	const [editingPresetId, setEditingPresetId] = useState<string | null>(null);
	const [editLabel, setEditLabel] = useState("");
	const [editBucket, setEditBucket] = useState<DurationKey>(defaultBucket);
	const [editApprovalOverride, setEditApprovalOverride] = useState<ApprovalOverrideOption>("DEFAULT");
	const [editIsShared, setEditIsShared] = useState(true);
	const [editIconKey, setEditIconKey] = useState<PresetIconKey | null>(null);
	const [presetSearchQuery, setPresetSearchQuery] = useState("");
	const [createModalOpen, setCreateModalOpen] = useState(false);
	const [isMounted, setIsMounted] = useState(false);
	const [isCreateActionPending, setIsCreateActionPending] = useState(false);
	const [isEditActionPending, setIsEditActionPending] = useState(false);

	useEffect(() => {
		if (!canManagePresets && taskCreateMode === "preset") {
			setTaskCreateMode("one-off");
		}
	}, [canManagePresets, taskCreateMode]);

	useEffect(() => {
		if (!allowOneOffMode && taskCreateMode === "one-off") {
			setTaskCreateMode("preset");
		}
	}, [allowOneOffMode, taskCreateMode]);

	useEffect(() => {
		setIsMounted(true);
	}, []);

	const useTaskCardGrid = showPresetList && !allowOneOffMode;

	const resetCustomForm = (): void => {
		setCustomLabel("");
		setCustomBucket(defaultBucket);
		setCustomApprovalOverride("DEFAULT");
		setCustomIsShared(true);
		setCustomIconKey(null);
	};

	const canCreate = customLabel.trim().length >= 2;
	const canUpdate = editLabel.trim().length >= 2;
	const isPresetMode = allowOneOffMode ? canManagePresets && taskCreateMode === "preset" : true;
	const primaryActionLabel = isPresetMode ? t("Create new chore") : t("Log one off task");
	const primaryActionPending = isPresetMode ? isPresetPending || isCreateActionPending : isPending;
	const createFormDisabled = disabled || isCreateActionPending;
	const editActionPending = isPresetPending || isEditActionPending;
	const editFormDisabled = disabled || isEditActionPending;
	const normalizedPresetSearchQuery = normalizeText(presetSearchQuery);
	const filteredEditablePresets =
		normalizedPresetSearchQuery.length > 0
			? sortedEditablePresets.filter((preset) => {
					const displayLabel = presetDisplayLabels.get(preset.id) ?? preset.label;
					return normalizeText(displayLabel).includes(normalizedPresetSearchQuery);
				})
			: sortedEditablePresets;
	const sortedEditablePresetsById = useMemo(() => {
		return new Map(sortedEditablePresets.map((preset) => [preset.id, preset]));
	}, [sortedEditablePresets]);
	const canReorderPresets =
		useTaskCardGrid &&
		normalizedPresetSearchQuery.length === 0 &&
		Boolean(onReorderPresets) &&
		!disabled &&
		!isPresetPending &&
		editingPresetId === null;
	const {
		sensors,
		dragOrderedPresetIds,
		activeDragPresetId,
		handleReorderDragStart,
		handleReorderDragCancel,
		handleReorderDragEnd,
	} = usePresetReorder({
		sortedEditablePresets,
		canReorderPresets,
		onReorderPresets,
	});
	const editingPreset = editingPresetId
		? (sortedEditablePresets.find((preset) => preset.id === editingPresetId) ?? null)
		: null;

	const handleCreatePreset = async (): Promise<void> => {
		if (!canCreate || isCreateActionPending) return;

		setIsCreateActionPending(true);
		try {
			const approvalOverride = resolveApprovalOverride(canEditApprovalOverride, customApprovalOverride);
			const success = await onCreatePreset(customLabel, customBucket, customIsShared, approvalOverride, customIconKey);
			if (success) {
				resetCustomForm();
				if (useTaskCardGrid) {
					setCreateModalOpen(false);
				}
			}
		} finally {
			setIsCreateActionPending(false);
		}
	};

	const handleCreatePresetFromTemplate = async (template: PresetTemplate): Promise<void> => {
		if (isCreateActionPending) return;

		setIsCreateActionPending(true);
		try {
			const approvalOverride = resolveApprovalOverride(canEditApprovalOverride, customApprovalOverride);
			const success = await onCreatePresetFromTemplate(template, customIsShared, approvalOverride, customIconKey);
			if (success) {
				resetCustomForm();
			}
		} finally {
			setIsCreateActionPending(false);
		}
	};

	const handleLogTimed = async (): Promise<void> => {
		if (!canCreate || !onLogTimed) return;
		const success = await onLogTimed(customLabel, customBucket);
		if (success) {
			setCustomLabel("");
			setCustomBucket(defaultBucket);
			onLogTimedSuccess?.();
		}
	};

	const startEdit = (preset: PresetSummary): void => {
		if (useTaskCardGrid) {
			setCreateModalOpen(false);
		}
		setIsCreateActionPending(false);
		setIsEditActionPending(false);
		setEditingPresetId(preset.id);
		setEditLabel(preset.label);
		setEditBucket(preset.bucket);
		setEditApprovalOverride(preset.approvalOverride ?? "DEFAULT");
		setEditIsShared(preset.isShared);
		setEditIconKey(preset.iconKey);
	};

	const cancelEdit = (): void => {
		setIsEditActionPending(false);
		setEditingPresetId(null);
		setEditLabel("");
		setEditBucket(defaultBucket);
		setEditApprovalOverride("DEFAULT");
		setEditIsShared(true);
		setEditIconKey(null);
	};

	const handleUpdatePreset = async (event: SyntheticEvent<HTMLFormElement>, presetId: string): Promise<void> => {
		event.preventDefault();
		if (!canUpdate || isEditActionPending) return;

		setIsEditActionPending(true);
		try {
			const approvalOverride = resolveApprovalOverride(canEditApprovalOverride, editApprovalOverride);
			const success = await onUpdatePreset(
				presetId,
				editLabel,
				editBucket,
				editIsShared,
				approvalOverride,
				editIconKey,
			);
			if (success) {
				setEditingPresetId(null);
			}
		} finally {
			setIsEditActionPending(false);
		}
	};

	const handleDeletePreset = async (presetId: string): Promise<void> => {
		if (isEditActionPending) return;

		setIsEditActionPending(true);
		try {
			const success = await onDeletePreset(presetId);
			if (success && editingPresetId === presetId) {
				setEditingPresetId(null);
			}
		} finally {
			setIsEditActionPending(false);
		}
	};

	const renderPresetItem = (preset: PresetSummary) => {
		if (useTaskCardGrid) {
			return (
				<TaskButton
					key={preset.id}
					id={preset.id}
					label={presetDisplayLabels.get(preset.id) ?? preset.label}
					bucket={preset.bucket}
					iconKey={preset.iconKey}
					disabled={disabled || isEditActionPending}
					onClick={() => undefined}
					isEditMode
					onEdit={() => startEdit(preset)}
					onDelete={() => void handleDeletePreset(preset.id)}
					canDelete={preset.createdById === currentUserId}
				/>
			);
		}

		return (
			<PresetListItem
				key={preset.id}
				preset={preset}
				displayLabel={presetDisplayLabels.get(preset.id) ?? preset.label}
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
				editIconKey={editIconKey}
				onEditIconKeyChange={setEditIconKey}
				canUpdatePreset={canUpdate}
				onUpdatePreset={handleUpdatePreset}
				onCancelEdit={cancelEdit}
				onStartEdit={startEdit}
				onDeletePreset={handleDeletePreset}
				canDelete={preset.createdById === currentUserId}
				canEditApprovalOverride={canEditApprovalOverride}
				canManagePresets={canManagePresets}
				disabled={disabled || isEditActionPending}
			/>
		);
	};

	const editFormPanel = (preset: PresetSummary) => (
		<form className="space-y-3" onSubmit={(event) => handleUpdatePreset(event, preset.id)}>
			<div className="space-y-2">
				<Label htmlFor={`preset-edit-${preset.id}`} className="text-xs text-muted-foreground">
					{t("Task name")}
				</Label>
				<Input
					id={`preset-edit-${preset.id}`}
					value={editLabel}
					onChange={(event) => setEditLabel(event.target.value)}
					disabled={editFormDisabled}
				/>
			</div>
			<div className="space-y-2">
				<Label htmlFor={`preset-bucket-${preset.id}`} className="text-xs text-muted-foreground">
					{t("Bucket")}
				</Label>
				<Select
					value={editBucket}
					onValueChange={(value: DurationKey) => setEditBucket(value)}
					disabled={editFormDisabled}
				>
					<SelectTrigger id={`preset-bucket-${preset.id}`}>
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
			</div>
			<div className="space-y-2">
				<Label htmlFor={`preset-icon-${preset.id}`} className="text-xs text-muted-foreground">
					{t("Icon")}
				</Label>
				<PresetIconPicker
					id={`preset-icon-${preset.id}`}
					value={editIconKey}
					onChange={setEditIconKey}
					disabled={editFormDisabled}
					placeholder={t("Pick an icon")}
					searchPlaceholder={t("Search icons...")}
					noneLabel={t("No icon")}
					noResultsLabel={t("No icon found.")}
				/>
			</div>
			{canManagePresets ? (
				<div className="space-y-2">
					<label className="flex items-center gap-2">
						<input
							type="checkbox"
							checked={editIsShared}
							onChange={(event) => setEditIsShared(event.target.checked)}
							disabled={editFormDisabled}
							className="h-4 w-4"
						/>
						<span className="text-sm">{t("Share with household")}</span>
					</label>
				</div>
			) : null}
			{canEditApprovalOverride ? (
				<div className="space-y-2">
					<p className="text-xs font-medium text-muted-foreground">{t("Approval override")}</p>
					<Select
						value={editApprovalOverride}
						onValueChange={(value: "DEFAULT" | "REQUIRE" | "SKIP") => setEditApprovalOverride(value)}
						disabled={editFormDisabled}
					>
						<SelectTrigger id={`preset-approval-${preset.id}`}>
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
			<div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
				<Button type="submit" className="w-full" disabled={editFormDisabled || !canUpdate}>
					{editActionPending ? <Loader2Icon className="mr-2 h-4 w-4 animate-spin" /> : null}
					{t("Save")}
				</Button>
				<Button
					type="button"
					variant="outline"
					className="w-full border-muted-foreground/40 hover:border-muted-foreground/60"
					onClick={cancelEdit}
					disabled={editFormDisabled}
				>
					{t("Cancel")}
				</Button>
			</div>
		</form>
	);

	const createFormPanel = (withContainer: boolean, showHeading: boolean = true) => (
		<div className={cn("space-y-3", withContainer ? "rounded-lg border p-4" : null)}>
			{showHeading ? (
				canManagePresets && allowOneOffMode ? (
					<Tabs
						value={taskCreateMode}
						onValueChange={(value) => setTaskCreateMode(value === "preset" ? "preset" : "one-off")}
						className="w-full"
					>
						<TabsList className="grid w-full grid-cols-2" aria-label={t("Add or log a one off chore")}>
							<TabsTrigger value="preset" disabled={createFormDisabled}>
								{t("Create new chore")}
							</TabsTrigger>
							<TabsTrigger value="one-off" disabled={createFormDisabled}>
								{t("Log one off task")}
							</TabsTrigger>
						</TabsList>
					</Tabs>
				) : (
					<p className="text-sm font-medium">{isPresetMode ? t("Create new chore") : t("Log one off task")}</p>
				)
			) : null}
			<div className="space-y-2">
				<Label htmlFor="custom-name" className="text-xs text-muted-foreground">
					{t("Task name")}
				</Label>
				<Input
					id="custom-name"
					placeholder={t("Name your task")}
					value={customLabel}
					onChange={(event) => setCustomLabel(event.target.value)}
					disabled={createFormDisabled}
				/>
			</div>
			{isPresetMode ? (
				<div className="space-y-2">
					<Label htmlFor="custom-icon" className="text-xs text-muted-foreground">
						{t("Icon")}
					</Label>
					<PresetIconPicker
						id="custom-icon"
						value={customIconKey}
						onChange={setCustomIconKey}
						disabled={createFormDisabled}
						placeholder={t("Pick an icon")}
						searchPlaceholder={t("Search icons...")}
						noneLabel={t("No icon")}
						noResultsLabel={t("No icon found.")}
					/>
				</div>
			) : null}
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
									disabled={createFormDisabled}
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
			{isPresetMode && canEditApprovalOverride ? (
				<div className="space-y-2">
					<p className="text-xs font-medium text-muted-foreground">{t("Approval override")}</p>
					<Select
						value={customApprovalOverride}
						onValueChange={(value: "DEFAULT" | "REQUIRE" | "SKIP") => setCustomApprovalOverride(value)}
						disabled={createFormDisabled}
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
			{isPresetMode && canManagePresets ? (
				<div className="space-y-2">
					<label className="flex items-center gap-2">
						<input
							type="checkbox"
							checked={customIsShared}
							onChange={(event) => setCustomIsShared(event.target.checked)}
							disabled={createFormDisabled}
							className="h-4 w-4"
						/>
						<span className="text-sm">{t("Share with household")}</span>
					</label>
					<p className="text-xs text-muted-foreground">
						{customIsShared ? t("Everyone can see and use this task") : t("Only you can see and use this task")}
					</p>
				</div>
			) : null}
			<Button
				type="button"
				className="h-auto min-h-9 w-full whitespace-normal px-3 py-2 text-center leading-tight"
				onClick={isPresetMode ? handleCreatePreset : handleLogTimed}
				disabled={createFormDisabled || !canCreate}
			>
				{primaryActionPending ? <Loader2Icon className="mr-2 h-4 w-4 animate-spin" /> : null}
				{primaryActionLabel}
			</Button>
			{useTaskCardGrid ? (
				<Button
					type="button"
					variant="outline"
					className="w-full"
					onClick={() => setCreateModalOpen(false)}
					disabled={createFormDisabled}
				>
					{t("Cancel")}
				</Button>
			) : null}
			{isPresetMode && canManagePresets && templatesByBucket.length > 0 ? (
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
									disabled={createFormDisabled}
								>
									{localizedPresetLabels.get(template.key) ?? template.label}
								</Button>
							)),
						)}
					</div>
				</div>
			) : null}
		</div>
	);

	if (useTaskCardGrid) {
		return (
			<div className={cn("space-y-3", !showListHeader ? "space-y-4" : null)}>
				<div className="space-y-2">
					{showListHeader ? (
						<div className="flex items-center justify-between gap-2">
							<p className="text-sm font-medium">{t("Tasks")}</p>
							<span className="rounded-md bg-muted px-2 py-0.5 text-xs text-muted-foreground">
								{filteredEditablePresets.length}
							</span>
						</div>
					) : null}
					<TaskSearchBar searchQuery={presetSearchQuery} onSearchChange={setPresetSearchQuery} />
				</div>
				<div className="grid gap-3 [grid-template-columns:repeat(auto-fill,minmax(320px,1fr))]">
					<Button
						type="button"
						variant="outline"
						className="group flex min-h-20 w-full cursor-pointer flex-col items-start justify-start gap-1 rounded-xl border-dashed border-primary/40 bg-gradient-to-br from-primary/10 via-background to-background px-3 py-3 text-left shadow-sm transition hover:-translate-y-0.5 hover:border-primary hover:from-primary/15 hover:shadow-md"
						onClick={() => setCreateModalOpen(true)}
						disabled={disabled}
					>
						<div className="flex items-center gap-2">
							<div className="rounded-md bg-white p-1.5 transition-colors group-hover:bg-white/90">
								<PlusIcon className="h-4 w-4 text-black" />
							</div>
							<span className="font-semibold">{t("Create new chore")}</span>
						</div>
						<span className="text-xs font-medium leading-tight text-muted-foreground">{t("Open task form")}</span>
					</Button>
					{sortedEditablePresets.length > 0 ? (
						canReorderPresets ? (
							<DndContext
								sensors={sensors}
								collisionDetection={closestCenter}
								onDragStart={handleReorderDragStart}
								onDragEnd={handleReorderDragEnd}
								onDragCancel={handleReorderDragCancel}
							>
								<SortableContext items={dragOrderedPresetIds} strategy={rectSortingStrategy}>
									{dragOrderedPresetIds.map((presetId) => {
										const preset = sortedEditablePresetsById.get(presetId);
										if (!preset) {
											return null;
										}

										return (
											<SortableGridItem
												key={preset.id}
												id={preset.id}
												disabled={!canReorderPresets}
												isActive={activeDragPresetId === preset.id}
											>
												{renderPresetItem(preset)}
											</SortableGridItem>
										);
									})}
								</SortableContext>
							</DndContext>
						) : (
							filteredEditablePresets.map((preset) => renderPresetItem(preset))
						)
					) : null}
				</div>
				{onReorderPresets && sortedEditablePresets.length > 0 ? (
					<p className="text-xs text-muted-foreground">
						{normalizedPresetSearchQuery.length === 0
							? t("Drag and drop tasks to reorder.")
							: t("Clear search to reorder tasks.")}
					</p>
				) : null}
				{sortedEditablePresets.length === 0 ? (
					<p className="text-xs text-muted-foreground">{t("No tasks yet")}</p>
				) : null}
				{sortedEditablePresets.length > 0 && filteredEditablePresets.length === 0 ? (
					<p className="text-xs text-muted-foreground">{t("No tasks match that search.")}</p>
				) : null}
				{createModalOpen && isMounted
					? createPortal(
							<div className="fixed inset-0 z-50">
								<button
									type="button"
									className="absolute inset-0 bg-background/80 backdrop-blur-sm"
									onClick={() => setCreateModalOpen(false)}
									aria-label={t("Close")}
								/>
								<div
									role="dialog"
									aria-modal="true"
									aria-label={t("Create new chore")}
									className="absolute inset-0 flex h-dvh w-full flex-col bg-background shadow-xl sm:inset-auto sm:left-1/2 sm:top-1/2 sm:h-auto sm:w-[calc(100%-2rem)] sm:max-w-2xl sm:-translate-x-1/2 sm:-translate-y-1/2 sm:rounded-xl sm:border"
								>
									<div className="flex items-center justify-between gap-2 border-b px-4 py-4">
										<p className="text-sm font-semibold">{t("Create new chore")}</p>
										<Button type="button" variant="ghost" size="sm" onClick={() => setCreateModalOpen(false)}>
											{t("Close")}
										</Button>
									</div>
									<div className="min-h-0 flex-1 overflow-y-auto p-4 sm:max-h-[80vh] sm:flex-none">
										{createFormPanel(false, false)}
									</div>
								</div>
							</div>,
							document.body,
						)
					: null}
				{editingPreset && isMounted
					? createPortal(
							<div className="fixed inset-0 z-50">
								<button
									type="button"
									className="absolute inset-0 bg-background/80 backdrop-blur-sm"
									onClick={cancelEdit}
									aria-label={t("Close")}
								/>
								<div
									role="dialog"
									aria-modal="true"
									aria-label={t("Edit task")}
									className="absolute inset-0 flex h-dvh w-full flex-col bg-background shadow-xl sm:inset-auto sm:left-1/2 sm:top-1/2 sm:h-auto sm:w-[calc(100%-2rem)] sm:max-w-2xl sm:-translate-x-1/2 sm:-translate-y-1/2 sm:rounded-xl sm:border"
								>
									<div className="flex items-center justify-between gap-2 border-b px-4 py-4">
										<p className="text-sm font-semibold">{t("Edit task")}</p>
										<Button type="button" variant="ghost" size="sm" onClick={cancelEdit}>
											{t("Close")}
										</Button>
									</div>
									<div className="min-h-0 flex-1 overflow-y-auto p-4 sm:max-h-[80vh] sm:flex-none">
										{editFormPanel(editingPreset)}
									</div>
								</div>
							</div>,
							document.body,
						)
					: null}
			</div>
		);
	}

	return (
		<div
			className={showPresetList ? "grid items-start gap-4 2xl:grid-cols-[minmax(0,540px)_minmax(0,1fr)]" : "space-y-3"}
		>
			{createFormPanel(true)}
			{showPresetList ? (
				<div className="space-y-3">
					<div className="space-y-2">
						<div className="flex items-center justify-between gap-2">
							<p className="text-sm font-medium">{t("Tasks")}</p>
							<p className="text-xs text-muted-foreground">{filteredEditablePresets.length}</p>
						</div>
						<Input
							placeholder={t("Search tasks")}
							value={presetSearchQuery}
							onChange={(event) => setPresetSearchQuery(event.target.value)}
							disabled={disabled}
						/>
					</div>
					{sortedEditablePresets.length === 0 ? (
						<p className="text-xs text-muted-foreground">{t("No tasks yet")}</p>
					) : filteredEditablePresets.length === 0 ? (
						<p className="text-xs text-muted-foreground">{t("No tasks match that search.")}</p>
					) : (
						filteredEditablePresets.map((preset) => renderPresetItem(preset))
					)}
				</div>
			) : null}
		</div>
	);
};
