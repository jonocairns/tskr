"use client";

import { Loader2Icon } from "lucide-react";
import type { FormEvent } from "react";
import { useState } from "react";

import { useTaskActions } from "@/components/task-actions/Context";
import type { PresetSummary } from "@/components/task-actions/types";
import { normalizeText } from "@/components/task-actions/utils";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import {
	Card,
	CardContent,
	CardDescription,
	CardHeader,
	CardTitle,
} from "@/components/ui/Card";
import { Input } from "@/components/ui/Input";
import { Label } from "@/components/ui/Label";
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from "@/components/ui/Select";
import { Separator } from "@/components/ui/Separator";
import { useToast } from "@/hooks/use-toast";
import { DURATION_BUCKETS, type DurationKey } from "@/lib/points";

export const PresetActionsCard = () => {
	const {
		presetOptions,
		customPresets,
		setCustomPresets,
		currentUserId,
		note,
		setNote,
		disabled,
		defaultBucket,
		isPresetPending,
		startPresetTransition,
		logPreset,
	} = useTaskActions();
	const [customLabel, setCustomLabel] = useState("");
	const [customBucket, setCustomBucket] = useState<DurationKey>(defaultBucket);
	const [customShared, setCustomShared] = useState(true);
	const [editingPresetId, setEditingPresetId] = useState<string | null>(null);
	const [editLabel, setEditLabel] = useState("");
	const [editBucket, setEditBucket] = useState<DurationKey>(defaultBucket);
	const [editShared, setEditShared] = useState(true);

	const { toast } = useToast();

	const canCreatePreset = customLabel.trim().length >= 2;
	const canUpdatePreset = editLabel.trim().length >= 2;

	const ownedPresets = customPresets.filter(
		(preset) => preset.createdById === currentUserId,
	);
	const customLabelQuery = normalizeText(customLabel);
	const shouldSearchCustomLabel = customLabelQuery.length >= 2;
	const presetLabelMatches = shouldSearchCustomLabel
		? presetOptions.filter((preset) =>
				normalizeText(preset.label).includes(customLabelQuery),
			)
		: [];

	const handleCreatePreset = (event: FormEvent<HTMLFormElement>) => {
		event.preventDefault();
		if (!canCreatePreset) {
			return;
		}

		startPresetTransition(async () => {
			const res = await fetch("/api/presets", {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({
					label: customLabel.trim(),
					bucket: customBucket,
					isShared: customShared,
				}),
			});

			if (!res.ok) {
				const body = await res.json().catch(() => ({}));
				toast({
					title: "Unable to add preset",
					description: body?.error ?? "Please try again.",
					variant: "destructive",
				});
				return;
			}

			const body = await res.json().catch(() => ({}));
			if (body?.preset) {
				setCustomPresets((prev) => [body.preset, ...prev]);
			}
			setCustomLabel("");
			setCustomShared(true);
			toast({
				title: "Preset added",
				description: customShared
					? "Shared preset is now available to everyone."
					: "Your preset is ready to log.",
			});
		});
	};

	const startEdit = (preset: PresetSummary) => {
		setEditingPresetId(preset.id);
		setEditLabel(preset.label);
		setEditBucket(preset.bucket);
		setEditShared(preset.isShared);
	};

	const cancelEdit = () => {
		setEditingPresetId(null);
	};

	const handleUpdatePreset = (
		event: FormEvent<HTMLFormElement>,
		presetId: string,
	) => {
		event.preventDefault();
		if (!canUpdatePreset) {
			return;
		}

		startPresetTransition(async () => {
			const res = await fetch(`/api/presets/${presetId}`, {
				method: "PATCH",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({
					label: editLabel.trim(),
					bucket: editBucket,
					isShared: editShared,
				}),
			});

			if (!res.ok) {
				const body = await res.json().catch(() => ({}));
				toast({
					title: "Unable to update preset",
					description: body?.error ?? "Please try again.",
					variant: "destructive",
				});
				return;
			}

			const body = await res.json().catch(() => ({}));
			if (body?.preset) {
				setCustomPresets((prev) =>
					prev.map((preset) => (preset.id === presetId ? body.preset : preset)),
				);
			}
			setEditingPresetId(null);
			toast({ title: "Preset updated" });
		});
	};

	const handleDeletePreset = (preset: PresetSummary) => {
		const confirmed = window.confirm(
			`Delete the "${preset.label}" preset? This cannot be undone.`,
		);
		if (!confirmed) {
			return;
		}

		startPresetTransition(async () => {
			const res = await fetch(`/api/presets/${preset.id}`, {
				method: "DELETE",
			});

			if (!res.ok) {
				const body = await res.json().catch(() => ({}));
				toast({
					title: "Unable to delete preset",
					description: body?.error ?? "Please try again.",
					variant: "destructive",
				});
				return;
			}

			setCustomPresets((prev) => prev.filter((item) => item.id !== preset.id));
			if (editingPresetId === preset.id) {
				setEditingPresetId(null);
			}
			toast({ title: "Preset deleted" });
		});
	};

	return (
		<Card>
			<CardHeader className="space-y-1">
				<CardDescription>One tap tasks</CardDescription>
				<CardTitle className="text-xl">Prebaked chores</CardTitle>
			</CardHeader>
			<CardContent className="space-y-4">
				<div className="grid gap-2 sm:grid-cols-2">
					{presetOptions.map((task) => {
						const bucket = DURATION_BUCKETS.find((b) => b.key === task.bucket);
						return (
							<Button
								key={task.id}
								variant="outline"
								className="flex h-auto flex-col items-start gap-1 py-3"
								onClick={() =>
									task.kind === "builtin"
										? logPreset({ presetKey: task.id })
										: logPreset({ presetId: task.id })
								}
								disabled={disabled}
							>
								<div className="flex w-full items-center justify-between gap-2">
									<span className="font-semibold">{task.label}</span>
									<div className="flex items-center gap-1">
										{task.isShared ? (
											<Badge variant="outline">Shared</Badge>
										) : null}
										<Badge variant="secondary">{bucket?.label}</Badge>
									</div>
								</div>
								<span className="text-xs text-muted-foreground">
									{bucket?.points ?? 0} pts · {bucket?.window}
								</span>
							</Button>
						);
					})}
				</div>
				<div className="space-y-2">
					<Label htmlFor="note">Note (optional)</Label>
					<Input
						id="note"
						placeholder="Add context (e.g. “extra messy today”)"
						value={note}
						onChange={(e) => setNote(e.target.value)}
						disabled={disabled}
					/>
				</div>
				<Separator />
				<details className="rounded-lg border p-3">
					<summary className="cursor-pointer text-sm font-medium">
						Add a custom preset
					</summary>
					<form className="mt-3 space-y-3" onSubmit={handleCreatePreset}>
						<div className="space-y-2">
							<div className="flex items-center justify-between">
								<Label htmlFor="preset-label">Preset name</Label>
								<Button
									type="button"
									variant="ghost"
									size="sm"
									onClick={() => setCustomLabel("")}
									disabled={disabled || customLabel.trim().length === 0}
								>
									Clear
								</Button>
							</div>
							<Input
								id="preset-label"
								placeholder="Preset name (e.g. “Laundry”)"
								value={customLabel}
								onChange={(e) => setCustomLabel(e.target.value)}
								disabled={disabled}
							/>
							{presetLabelMatches.length > 0 ? (
								<div className="rounded-md border bg-muted/40 p-2 text-xs">
									<p className="text-muted-foreground">
										This preset already exists. Log it instead:
									</p>
									<div className="mt-2 flex flex-wrap gap-2">
										{presetLabelMatches.slice(0, 6).map((preset) => {
											const bucket = DURATION_BUCKETS.find(
												(item) => item.key === preset.bucket,
											);
											return (
												<Button
													key={`preset-match-${preset.id}`}
													type="button"
													variant="secondary"
													size="sm"
													onClick={() => {
														logPreset(
															preset.kind === "builtin"
																? { presetKey: preset.id }
																: { presetId: preset.id },
														);
														setCustomLabel("");
													}}
													disabled={disabled}
												>
													Log {preset.label} · {bucket?.label ?? preset.bucket}
												</Button>
											);
										})}
									</div>
								</div>
							) : null}
						</div>
						<div className="grid gap-3 sm:grid-cols-[1fr_auto]">
							<div className="space-y-2">
								<Label htmlFor="preset-bucket">Bucket</Label>
								<Select
									value={customBucket}
									onValueChange={(value: DurationKey) => setCustomBucket(value)}
									disabled={disabled}
								>
									<SelectTrigger id="preset-bucket">
										<SelectValue placeholder="Pick a bucket" />
									</SelectTrigger>
									<SelectContent>
										{DURATION_BUCKETS.map((bucket) => (
											<SelectItem key={bucket.key} value={bucket.key}>
												{bucket.label} ({bucket.points} pts)
											</SelectItem>
										))}
									</SelectContent>
								</Select>
							</div>
							<div className="flex items-end">
								<Button
									type="submit"
									variant="secondary"
									disabled={disabled || !canCreatePreset}
								>
									{isPresetPending ? (
										<Loader2Icon className="mr-2 h-4 w-4 animate-spin" />
									) : null}
									Add preset
								</Button>
							</div>
						</div>
						<div className="flex items-center gap-2 text-sm">
							<input
								id="preset-shared"
								type="checkbox"
								className="h-4 w-4 rounded border-input"
								checked={customShared}
								onChange={(e) => setCustomShared(e.target.checked)}
								disabled={disabled}
							/>
							<Label htmlFor="preset-shared" className="font-normal">
								Share with everyone
							</Label>
						</div>
						<p className="text-xs text-muted-foreground">
							Shared presets appear for all users.
						</p>
					</form>
				</details>
				<div className="space-y-2">
					<p className="text-sm font-medium">Your presets</p>
					{ownedPresets.length === 0 ? (
						<p className="text-xs text-muted-foreground">
							No custom presets yet.
						</p>
					) : (
						ownedPresets.map((preset) => {
							const bucket = DURATION_BUCKETS.find(
								(item) => item.key === preset.bucket,
							);
							const isEditing = editingPresetId === preset.id;

							if (isEditing) {
								return (
									<form
										key={preset.id}
										className="space-y-3 rounded-lg border p-3"
										onSubmit={(event) => handleUpdatePreset(event, preset.id)}
									>
										<div className="space-y-2">
											<Label htmlFor={`preset-edit-${preset.id}`}>Name</Label>
											<Input
												id={`preset-edit-${preset.id}`}
												value={editLabel}
												onChange={(e) => setEditLabel(e.target.value)}
												disabled={disabled}
											/>
										</div>
										<div className="space-y-2">
											<Label htmlFor={`preset-bucket-${preset.id}`}>
												Bucket
											</Label>
											<Select
												value={editBucket}
												onValueChange={(value: DurationKey) =>
													setEditBucket(value)
												}
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
										<div className="flex items-center gap-2 text-sm">
											<input
												id={`preset-share-${preset.id}`}
												type="checkbox"
												className="h-4 w-4 rounded border-input"
												checked={editShared}
												onChange={(e) => setEditShared(e.target.checked)}
												disabled={disabled}
											/>
											<Label
												htmlFor={`preset-share-${preset.id}`}
												className="font-normal"
											>
												Share with everyone
											</Label>
										</div>
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
												onClick={cancelEdit}
												disabled={disabled}
											>
												Cancel
											</Button>
										</div>
									</form>
								);
							}

							return (
								<div
									key={preset.id}
									className="flex items-center justify-between gap-3 rounded-lg border p-3"
								>
									<div className="space-y-1">
										<div className="flex items-center gap-2">
											<p className="text-sm font-medium">{preset.label}</p>
											{preset.isShared ? (
												<Badge variant="outline">Shared</Badge>
											) : null}
										</div>
										<p className="text-xs text-muted-foreground">
											{bucket?.label ?? preset.bucket} · {bucket?.points ?? 0}{" "}
											pts
										</p>
									</div>
									<div className="flex items-center gap-2">
										<Button
											type="button"
											variant="ghost"
											size="sm"
											onClick={() => startEdit(preset)}
											disabled={disabled}
										>
											Edit
										</Button>
										<Button
											type="button"
											variant="ghost"
											size="sm"
											onClick={() => handleDeletePreset(preset)}
											disabled={disabled}
										>
											Delete
										</Button>
									</div>
								</div>
							);
						})
					)}
				</div>
			</CardContent>
		</Card>
	);
};
