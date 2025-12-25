"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

import { useTaskActions } from "@/components/task-actions/Context";
import { PresetActionsDrawer } from "@/components/task-actions/PresetActionsDrawer";
import type { PresetTemplate } from "@/components/task-actions/types";
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
import { useToast } from "@/hooks/use-toast";
import { DURATION_BUCKETS, type DurationKey } from "@/lib/points";

export const PresetActionsCard = () => {
	const {
		presetOptions,
		presetTemplates,
		customPresets,
		setCustomPresets,
		currentUserId,
		disabled,
		defaultBucket,
		isPending,
		isPresetPending,
		startTransition,
		startPresetTransition,
		logPreset,
	} = useTaskActions();
	const [isEditDrawerOpen, setEditDrawerOpen] = useState(false);

	const router = useRouter();
	const { toast } = useToast();

	const editablePresets = customPresets.filter(
		(preset) => preset.isShared || preset.createdById === currentUserId,
	);
	const sortedEditablePresets = [...editablePresets].sort((a, b) => {
		return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
	});
	const appliedTemplateKeys = new Set(
		presetOptions.map(
			(preset) => `${normalizeText(preset.label)}|${preset.bucket}`,
		),
	);
	const templatesByBucket = DURATION_BUCKETS.map((bucket) => ({
		bucket,
		templates: presetTemplates.filter(
			(template) =>
				template.bucket === bucket.key &&
				!appliedTemplateKeys.has(
					`${normalizeText(template.label)}|${template.bucket}`,
				),
		),
	})).filter((group) => group.templates.length > 0);

	const handleCreatePresetFromTemplate = async (template: PresetTemplate) => {
		const key = `${normalizeText(template.label)}|${template.bucket}`;
		if (appliedTemplateKeys.has(key)) {
			return false;
		}

		let success = false;
		await new Promise<void>((resolve) =>
			startPresetTransition(async () => {
				const res = await fetch("/api/presets", {
					method: "POST",
					headers: { "Content-Type": "application/json" },
					body: JSON.stringify({
						label: template.label,
						bucket: template.bucket,
						isShared: true,
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
					success = true;
				}
				toast({
					title: "Preset added",
					description: "Template added to your presets.",
				});
				resolve();
			}),
		);
		return success;
	};

	const handleCreatePreset = async (
		label: string,
		bucket: DurationKey,
	): Promise<boolean> => {
		if (label.trim().length < 2) {
			return false;
		}

		let success = false;
		await new Promise<void>((resolve) =>
			startPresetTransition(async () => {
				const res = await fetch("/api/presets", {
					method: "POST",
					headers: { "Content-Type": "application/json" },
					body: JSON.stringify({
						label: label.trim(),
						bucket,
						isShared: true,
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
				toast({
					title: "Preset added",
					description: "Chore added to your presets.",
				});
				success = true;
				resolve();
			}),
		);

		return success;
	};

	const handleLogTimed = async (
		label: string,
		bucket: DurationKey,
	): Promise<boolean> => {
		if (label.trim().length < 2) {
			return false;
		}

		let success = false;
		await new Promise<void>((resolve) =>
			startTransition(async () => {
				const res = await fetch("/api/logs", {
					method: "POST",
					headers: { "Content-Type": "application/json" },
					body: JSON.stringify({
						type: "timed",
						bucket,
						description: label.trim(),
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

				toast({
					title: "Task logged",
					description: "Time-based task recorded and points added.",
				});
				router.refresh();
				success = true;
				resolve();
			}),
		);
		return success;
	};

	const closeEditDrawer = () => {
		setEditDrawerOpen(false);
	};

	const handleUpdatePreset = async (
		presetId: string,
		label: string,
		bucket: DurationKey,
	): Promise<boolean> => {
		if (label.trim().length < 2) {
			return false;
		}

		let success = false;
		await new Promise<void>((resolve) =>
			startPresetTransition(async () => {
				const res = await fetch(`/api/presets/${presetId}`, {
					method: "PATCH",
					headers: { "Content-Type": "application/json" },
					body: JSON.stringify({
						label: label.trim(),
						bucket,
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
						prev.map((preset) =>
							preset.id === presetId ? body.preset : preset,
						),
					);
				}
				toast({ title: "Preset updated" });
				success = true;
				resolve();
			}),
		);
		return success;
	};

	const handleDeletePreset = async (presetId: string): Promise<boolean> => {
		let success = false;
		await new Promise<void>((resolve) =>
			startPresetTransition(async () => {
				const res = await fetch(`/api/presets/${presetId}`, {
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

				setCustomPresets((prev) => prev.filter((item) => item.id !== presetId));
				toast({ title: "Preset deleted" });
				success = true;
				resolve();
			}),
		);
		return success;
	};

	return (
		<>
			<Card>
				<CardHeader className="space-y-1">
					<div className="flex items-start justify-between gap-2">
						<div className="space-y-1">
							<CardTitle className="text-xl">Chores</CardTitle>
							<CardDescription>
								Tap a chore once you've completed it.
							</CardDescription>
						</div>
						<Button
							type="button"
							variant="ghost"
							size="sm"
							onClick={() => setEditDrawerOpen(true)}
						>
							Change
						</Button>
					</div>
				</CardHeader>
				<CardContent>
					<div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
						{presetOptions.length === 0 ? (
							<p className="text-sm text-muted-foreground sm:col-span-2 lg:col-span-3">
								No saved chores yet.
							</p>
						) : (
							presetOptions.map((task) => {
								const bucket = DURATION_BUCKETS.find(
									(b) => b.key === task.bucket,
								);
								return (
									<Button
										key={task.id}
										variant="outline"
										className="flex h-auto flex-col items-start gap-1 py-3"
										onClick={() => logPreset({ presetId: task.id })}
										disabled={disabled}
									>
										<div className="flex w-full items-center justify-between gap-2">
											<span className="font-semibold">{task.label}</span>
											<div className="flex items-center gap-1">
												<Badge variant="secondary">{bucket?.label}</Badge>
											</div>
										</div>
										<span className="text-xs text-muted-foreground">
											{bucket?.points ?? 0} pts · {bucket?.window}
										</span>
									</Button>
								);
							})
						)}
					</div>
				</CardContent>
			</Card>
			<PresetActionsDrawer
				isOpen={isEditDrawerOpen}
				onClose={closeEditDrawer}
				defaultBucket={defaultBucket}
				onLogTimed={handleLogTimed}
				onCreatePreset={handleCreatePreset}
				onCreatePresetFromTemplate={handleCreatePresetFromTemplate}
				onUpdatePreset={handleUpdatePreset}
				onDeletePreset={handleDeletePreset}
				templatesByBucket={templatesByBucket}
				disabled={disabled}
				isPending={isPending}
				isPresetPending={isPresetPending}
				sortedEditablePresets={sortedEditablePresets}
				currentUserId={currentUserId}
			/>
		</>
	);
};
