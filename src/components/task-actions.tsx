"use client";

import { Loader2Icon, SparklesIcon } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useState, useTransition } from "react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
	Card,
	CardContent,
	CardDescription,
	CardHeader,
	CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { DURATION_BUCKETS, type DurationKey, PRESET_TASKS } from "@/lib/points";
import { cn } from "@/lib/utils";

type PresetSummary = {
	id: string;
	label: string;
	bucket: DurationKey;
	isShared: boolean;
	createdById: string;
};

type TaskActionsProps = {
	presets: PresetSummary[];
	currentUserId: string;
};

export function TaskActions({ presets, currentUserId }: TaskActionsProps) {
	const defaultBucket =
		DURATION_BUCKETS.find((bucket) => bucket.key === "QUICK")?.key ??
		DURATION_BUCKETS[0].key;
	const [selectedBucket, setSelectedBucket] = useState(defaultBucket);
	const [note, setNote] = useState("");
	const [description, setDescription] = useState("");
	const [durationMinutes, setDurationMinutes] = useState("");
	const [customPresets, setCustomPresets] = useState(presets);
	const [customLabel, setCustomLabel] = useState("");
	const [customBucket, setCustomBucket] = useState<DurationKey>(defaultBucket);
	const [customShared, setCustomShared] = useState(true);
	const [editingPresetId, setEditingPresetId] = useState<string | null>(null);
	const [editLabel, setEditLabel] = useState("");
	const [editBucket, setEditBucket] = useState<DurationKey>(defaultBucket);
	const [editShared, setEditShared] = useState(true);
	const [isPending, startTransition] = useTransition();
	const [isPresetPending, startPresetTransition] = useTransition();

	const router = useRouter();
	const { toast } = useToast();

	const normalizeText = (value: string) => value.trim().toLowerCase();

	const disabled = isPending || isPresetPending;
	const canCreatePreset = customLabel.trim().length >= 2;
	const canUpdatePreset = editLabel.trim().length >= 2;

	useEffect(() => {
		setCustomPresets(presets);
	}, [presets]);

	const logPreset = (
		payload: { presetKey?: string; presetId?: string },
		overrideNote?: string,
	) => {
		startTransition(async () => {
			const noteValue = overrideNote ?? note.trim();
			const res = await fetch("/api/logs", {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({
					type: "preset",
					...payload,
					description: noteValue || undefined,
				}),
			});

			if (!res.ok) {
				const body = await res.json().catch(() => ({}));
				toast({
					title: "Unable to log task",
					description: body?.error ?? "Please try again.",
					variant: "destructive",
				});
				return;
			}

			setNote("");
			toast({
				title: "Task logged",
				description: "Preset task recorded and points added.",
			});
			router.refresh();
		});
	};

	const handleCreatePreset = (event: React.FormEvent<HTMLFormElement>) => {
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
		event: React.FormEvent<HTMLFormElement>,
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

	const presetOptions = [
		...PRESET_TASKS.map((task) => ({
			kind: "builtin" as const,
			id: task.key,
			label: task.label,
			bucket: task.bucket,
			isShared: false,
		})),
		...customPresets.map((task) => ({
			kind: "custom" as const,
			id: task.id,
			label: task.label,
			bucket: task.bucket,
			isShared: task.isShared,
		})),
	];
	const ownedPresets = customPresets.filter(
		(preset) => preset.createdById === currentUserId,
	);
	const customLabelQuery = normalizeText(customLabel);
	const descriptionQuery = normalizeText(description);
	const shouldSearchCustomLabel = customLabelQuery.length >= 2;
	const shouldSearchDescription = descriptionQuery.length >= 2;
	const presetLabelMatches = shouldSearchCustomLabel
		? presetOptions.filter((preset) =>
				normalizeText(preset.label).includes(customLabelQuery),
			)
		: [];
	const descriptionMatches = shouldSearchDescription
		? presetOptions.filter((preset) =>
				normalizeText(preset.label).includes(descriptionQuery),
			)
		: [];

	const handleTimed = (event: React.FormEvent<HTMLFormElement>) => {
		event.preventDefault();
		const minutes =
			durationMinutes.trim().length > 0 ? Number(durationMinutes) : undefined;

		startTransition(async () => {
			const res = await fetch("/api/logs", {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({
					type: "timed",
					bucket: selectedBucket,
					description: description.trim(),
					durationMinutes: minutes,
				}),
			});

			if (!res.ok) {
				const body = await res.json().catch(() => ({}));
				toast({
					title: "Unable to log task",
					description: body?.error ?? "Please try again.",
					variant: "destructive",
				});
				return;
			}

			setDescription("");
			setDurationMinutes("");
			toast({
				title: "Task logged",
				description: "Time-based task recorded and points added.",
			});
			router.refresh();
		});
	};

	return (
		<div className="grid gap-4 lg:grid-cols-2">
			<Card>
				<CardHeader className="space-y-1">
					<CardDescription>One tap tasks</CardDescription>
					<CardTitle className="text-xl">Prebaked chores</CardTitle>
				</CardHeader>
				<CardContent className="space-y-4">
					<div className="grid gap-2 sm:grid-cols-2">
						{presetOptions.map((task) => {
							const bucket = DURATION_BUCKETS.find(
								(b) => b.key === task.bucket,
							);
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
														Log {preset.label} ·{" "}
														{bucket?.label ?? preset.bucket}
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
										onValueChange={(value) =>
											setCustomBucket(value as DurationKey)
										}
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
													onValueChange={(value) =>
														setEditBucket(value as DurationKey)
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

			<Card>
				<CardHeader className="space-y-1">
					<CardDescription>Time-based logging</CardDescription>
					<CardTitle className="text-xl">How long did it take?</CardTitle>
				</CardHeader>
				<CardContent>
					<form className="space-y-4" onSubmit={handleTimed}>
						<div className="grid gap-2 sm:grid-cols-2">
							{DURATION_BUCKETS.map((bucket) => (
								<button
									key={bucket.key}
									type="button"
									onClick={() => setSelectedBucket(bucket.key)}
									className={cn(
										"flex flex-col items-start rounded-lg border p-3 text-left transition hover:border-primary",
										selectedBucket === bucket.key &&
											"border-primary bg-primary/5",
									)}
									disabled={disabled}
								>
									<div className="flex w-full items-center justify-between">
										<span className="font-semibold">{bucket.label}</span>
										<Badge variant="secondary">{bucket.points} pts</Badge>
									</div>
									<span className="text-xs text-muted-foreground">
										{bucket.window}
									</span>
								</button>
							))}
						</div>

						<div className="grid gap-3">
							<div className="space-y-2">
								<div className="flex items-center justify-between">
									<Label htmlFor="description">What was the task?</Label>
									<Button
										type="button"
										variant="ghost"
										size="sm"
										onClick={() => setDescription("")}
										disabled={disabled || description.trim().length === 0}
									>
										Clear
									</Button>
								</div>
								<Textarea
									id="description"
									placeholder="Briefly describe what you completed"
									minLength={2}
									maxLength={160}
									value={description}
									onChange={(e) => setDescription(e.target.value)}
									disabled={disabled}
									required
								/>
								{descriptionMatches.length > 0 ? (
									<div className="rounded-md border bg-muted/40 p-2 text-xs">
										<p className="text-muted-foreground">
											This looks like an existing preset. Log it instead:
										</p>
										<div className="mt-2 flex flex-wrap gap-2">
											{descriptionMatches.slice(0, 6).map((preset) => {
												const bucket = DURATION_BUCKETS.find(
													(item) => item.key === preset.bucket,
												);
												return (
													<Button
														key={`preset-desc-${preset.id}`}
														type="button"
														variant="secondary"
														size="sm"
														onClick={() => {
															logPreset(
																preset.kind === "builtin"
																	? { presetKey: preset.id }
																	: { presetId: preset.id },
																description.trim() || undefined,
															);
															setDescription("");
															setDurationMinutes("");
														}}
														disabled={disabled}
													>
														{preset.label} · {bucket?.points ?? 0} pts
													</Button>
												);
											})}
										</div>
									</div>
								) : null}
							</div>
						</div>

						<Button
							type="submit"
							size="lg"
							className="w-full sm:w-auto"
							disabled={disabled || description.trim().length === 0}
						>
							{isPending ? (
								<Loader2Icon className="mr-2 h-4 w-4 animate-spin" />
							) : (
								<SparklesIcon className="mr-2 h-4 w-4" />
							)}
							Log{" "}
							{DURATION_BUCKETS.find((b) => b.key === selectedBucket)?.points}{" "}
							pts
						</Button>
					</form>
				</CardContent>
			</Card>
		</div>
	);
}
