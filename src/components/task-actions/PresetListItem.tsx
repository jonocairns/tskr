import type { FormEvent } from "react";

import type { PresetSummary } from "@/components/task-actions/types";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Label } from "@/components/ui/Label";
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from "@/components/ui/Select";
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
	canUpdatePreset: boolean;
	onUpdatePreset: (event: FormEvent<HTMLFormElement>, presetId: string) => void;
	onCancelEdit: () => void;
	onStartEdit: (preset: PresetSummary) => void;
	onDeletePreset: (presetId: string, label: string) => void;
	canDelete: boolean;
	canEditApprovalOverride: boolean;
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
	canUpdatePreset,
	onUpdatePreset,
	onCancelEdit,
	onStartEdit,
	onDeletePreset,
	canDelete,
	canEditApprovalOverride,
	disabled,
}: Props) {
	if (isEditing) {
		return (
			<form
				className="space-y-3 rounded-lg border p-3"
				onSubmit={(event) => onUpdatePreset(event, preset.id)}
			>
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
				{canEditApprovalOverride ? (
					<div className="space-y-2">
						<Label htmlFor={`preset-approval-${preset.id}`}>
							Approval override
						</Label>
						<Select
							value={editApprovalOverride}
							onValueChange={(value: "DEFAULT" | "REQUIRE" | "SKIP") =>
								onEditApprovalOverrideChange(value)
							}
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
					<Button
						type="submit"
						size="sm"
						disabled={disabled || !canUpdatePreset}
					>
						Save
					</Button>
					<Button
						type="button"
						variant="ghost"
						size="sm"
						onClick={onCancelEdit}
						disabled={disabled}
					>
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
			<div className="flex items-center gap-2">
				<Button
					type="button"
					variant="ghost"
					size="sm"
					onClick={() => onStartEdit(preset)}
					disabled={disabled}
				>
					Edit
				</Button>
				{canDelete ? (
					<Button
						type="button"
						variant="ghost"
						size="sm"
						onClick={() => onDeletePreset(preset.id, preset.label)}
						disabled={disabled}
					>
						Delete
					</Button>
				) : null}
			</div>
		</div>
	);
}
