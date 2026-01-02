import { PencilIcon, Trash2Icon } from "lucide-react";
import type { FormEvent } from "react";

import type { PresetSummary } from "@/components/task-actions/types";
import {
	AlertDialog,
	AlertDialogAction,
	AlertDialogCancel,
	AlertDialogContent,
	AlertDialogDescription,
	AlertDialogFooter,
	AlertDialogHeader,
	AlertDialogTitle,
	AlertDialogTrigger,
} from "@/components/ui/AlertDialog";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Label } from "@/components/ui/Label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/Select";
import type { DurationKey } from "@/lib/points";
import { DURATION_BUCKETS } from "@/lib/points";

type Props = {
	preset: PresetSummary;
	bucket?: (typeof DURATION_BUCKETS)[number];
	isEditing: boolean;
	editLabel: string;
	onEditLabelChange: (value: string) => void;
	editBucket: DurationKey;
	onEditBucketChange: (bucket: DurationKey) => void;
	editApprovalOverride: "DEFAULT" | "REQUIRE" | "SKIP";
	onEditApprovalOverrideChange: (value: "DEFAULT" | "REQUIRE" | "SKIP") => void;
	editIsShared: boolean;
	onEditIsSharedChange: (value: boolean) => void;
	canUpdatePreset: boolean;
	onUpdatePreset: (event: FormEvent<HTMLFormElement>, presetId: string) => void;
	onCancelEdit: () => void;
	onStartEdit: (preset: PresetSummary) => void;
	onDeletePreset: (presetId: string, label: string) => void;
	canDelete: boolean;
	canEditApprovalOverride: boolean;
	canManagePresets: boolean;
	disabled: boolean;
};

export function PresetListItem({
	preset,
	bucket,
	isEditing,
	editLabel,
	onEditLabelChange,
	editBucket,
	onEditBucketChange,
	editApprovalOverride,
	onEditApprovalOverrideChange,
	editIsShared,
	onEditIsSharedChange,
	canUpdatePreset,
	onUpdatePreset,
	onCancelEdit,
	onStartEdit,
	onDeletePreset,
	canDelete,
	canEditApprovalOverride,
	canManagePresets,
	disabled,
}: Props) {
	if (isEditing) {
		return (
			<form className="space-y-3 rounded-lg border p-3" onSubmit={(event) => onUpdatePreset(event, preset.id)}>
				<div className="space-y-2">
					<Label htmlFor={`preset-edit-${preset.id}`}>Name</Label>
					<Input
						id={`preset-edit-${preset.id}`}
						value={editLabel}
						onChange={(e) => onEditLabelChange(e.target.value)}
						disabled={disabled}
					/>
				</div>
				<div className="space-y-2">
					<Label htmlFor={`preset-bucket-${preset.id}`}>Bucket</Label>
					<Select
						value={editBucket}
						onValueChange={(value: DurationKey) => onEditBucketChange(value)}
						disabled={disabled}
					>
						<SelectTrigger id={`preset-bucket-${preset.id}`}>
							<SelectValue placeholder="Pick a bucket" />
						</SelectTrigger>
						<SelectContent>
							{DURATION_BUCKETS.map((item) => (
								<SelectItem key={item.key} value={item.key}>
									{item.label} ({item.points} pts)
								</SelectItem>
							))}
						</SelectContent>
					</Select>
				</div>
				{canManagePresets ? (
					<div className="space-y-2">
						<label className="flex items-center gap-2">
							<input
								type="checkbox"
								checked={editIsShared}
								onChange={(e) => onEditIsSharedChange(e.target.checked)}
								disabled={disabled}
								className="h-4 w-4"
							/>
							<span className="text-sm">Share with household</span>
						</label>
					</div>
				) : null}
				{canEditApprovalOverride ? (
					<div className="space-y-2">
						<Label htmlFor={`preset-approval-${preset.id}`}>Approval override</Label>
						<Select
							value={editApprovalOverride}
							onValueChange={(value: "DEFAULT" | "REQUIRE" | "SKIP") => onEditApprovalOverrideChange(value)}
							disabled={disabled}
						>
							<SelectTrigger id={`preset-approval-${preset.id}`}>
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
				<div className="flex items-center gap-2">
					<Button type="submit" size="sm" disabled={disabled || !canUpdatePreset}>
						Save
					</Button>
					<Button type="button" variant="ghost" size="sm" onClick={onCancelEdit} disabled={disabled}>
						Cancel
					</Button>
				</div>
			</form>
		);
	}

	return (
		<div className="flex items-center justify-between gap-3 rounded-lg border p-3">
			<div className="space-y-1">
				<div className="flex items-center gap-2">
					<p className="text-sm font-medium">{preset.label}</p>
					{!preset.isShared ? (
						<span className="rounded bg-muted px-1.5 py-0.5 text-xs text-muted-foreground">Personal</span>
					) : null}
				</div>
				<p className="text-xs text-muted-foreground">
					{bucket?.label ?? preset.bucket} · {bucket?.points ?? 0} pts
				</p>
				{preset.approvalOverride ? (
					<p className="text-xs text-muted-foreground">
						Approval {preset.approvalOverride === "REQUIRE" ? "required" : "skipped"}
					</p>
				) : null}
			</div>
			<div className="flex items-center gap-1">
				<Button
					type="button"
					variant="ghost"
					size="icon"
					onClick={() => onStartEdit(preset)}
					disabled={disabled}
					aria-label="Edit task"
					className="h-9 w-9"
				>
					<PencilIcon className="h-5 w-5" />
				</Button>
				{canDelete ? (
					<AlertDialog>
						<AlertDialogTrigger asChild>
							<Button
								type="button"
								variant="ghost"
								size="icon"
								disabled={disabled}
								aria-label="Delete task"
								className="h-9 w-9"
							>
								<Trash2Icon className="h-5 w-5 text-destructive" />
							</Button>
						</AlertDialogTrigger>
						<AlertDialogContent>
							<AlertDialogHeader>
								<AlertDialogTitle>Delete task preset?</AlertDialogTitle>
								<AlertDialogDescription>This will delete "{preset.label}" and cannot be undone.</AlertDialogDescription>
							</AlertDialogHeader>
							<AlertDialogFooter>
								<AlertDialogCancel>Cancel</AlertDialogCancel>
								<AlertDialogAction
									type="button"
									onClick={() => onDeletePreset(preset.id, preset.label)}
									className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
								>
									Delete
								</AlertDialogAction>
							</AlertDialogFooter>
						</AlertDialogContent>
					</AlertDialog>
				) : null}
			</div>
		</div>
	);
}
