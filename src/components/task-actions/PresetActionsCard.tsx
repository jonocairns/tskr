"use client";

import { useParams, useRouter } from "next/navigation";
import { useState } from "react";

import { useTaskActions } from "@/components/task-actions/Context";
import { PresetActionsDrawer } from "@/components/task-actions/PresetActionsDrawer";
import type { PresetTemplate } from "@/components/task-actions/types";
import { normalizeText } from "@/components/task-actions/utils";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/Card";
import { Input } from "@/components/ui/Input";
import { Label } from "@/components/ui/Label";
import { useToast } from "@/hooks/useToast";
import { DURATION_BUCKETS, type DurationKey } from "@/lib/points";
import { trpc } from "@/lib/trpc/react";
import type { HouseholdRouteParams } from "@/types/routes";

export const PresetActionsCard = () => {
	const {
		presetOptions,
		presetTemplates,
		customPresets,
		setCustomPresets,
		currentUserId,
		currentUserRole,
		disabled,
		defaultBucket,
		isPending,
		isPresetPending,
		startPresetTransition,
		logPreset,
	} = useTaskActions();
	const [isEditDrawerOpen, setEditDrawerOpen] = useState(false);

	const params = useParams<HouseholdRouteParams>();
	const householdId = params.householdId;
	const router = useRouter();
	const { toast } = useToast();
	const utils = trpc.useUtils();
	const canSharePresets = currentUserRole !== "DOER";
	const canEditApprovalOverride = currentUserRole !== "DOER";
	const [searchQuery, setSearchQuery] = useState("");

	const createPresetMutation = trpc.presets.create.useMutation({
		onSuccess: (data) => {
			setCustomPresets((prev) => [
				{
					...data.preset,
					bucket: data.preset.bucket as DurationKey,
					createdAt: data.preset.createdAt.toISOString(),
				},
				...prev,
			]);
			toast({
				title: "Preset added",
				description: "Chore added to your presets.",
			});
		},
		onError: (error) => {
			toast({
				title: "Unable to add preset",
				description: error.message ?? "Please try again.",
				variant: "destructive",
			});
		},
	});

	const updatePresetMutation = trpc.presets.update.useMutation({
		onMutate: async (variables) => {
			const previousPresets = customPresets;
			setCustomPresets((prev) =>
				prev.map((preset) =>
					preset.id === variables.id
						? {
								...preset,
								label: variables.label ?? preset.label,
								bucket: variables.bucket ?? preset.bucket,
								approvalOverride: variables.approvalOverride ?? preset.approvalOverride,
							}
						: preset,
				),
			);
			return { previousPresets };
		},
		onError: (error, _variables, context) => {
			if (context?.previousPresets) {
				setCustomPresets(context.previousPresets);
			}
			toast({
				title: "Unable to update preset",
				description: error.message ?? "Please try again.",
				variant: "destructive",
			});
		},
		onSuccess: (data) => {
			setCustomPresets((prev) =>
				prev.map((preset) =>
					preset.id === data.preset.id
						? {
								...data.preset,
								bucket: data.preset.bucket as DurationKey,
								createdAt: data.preset.createdAt.toISOString(),
							}
						: preset,
				),
			);
			toast({ title: "Preset updated" });
		},
	});

	const deletePresetMutation = trpc.presets.delete.useMutation({
		onMutate: async (variables) => {
			const previousPresets = customPresets;
			setCustomPresets((prev) => prev.filter((item) => item.id !== variables.id));
			return { previousPresets };
		},
		onError: (error, _variables, context) => {
			if (context?.previousPresets) {
				setCustomPresets(context.previousPresets);
			}
			toast({
				title: "Unable to delete preset",
				description: error.message ?? "Please try again.",
				variant: "destructive",
			});
		},
		onSuccess: () => {
			toast({ title: "Preset deleted" });
		},
	});

	const createLogMutation = trpc.logs.create.useMutation({
		onSuccess: (data) => {
			const isPending = data.entry.status === "PENDING";
			toast({
				title: isPending ? "Submitted for approval" : "Task logged",
				description: isPending ? "Task logged and waiting for approval." : "Time-based task recorded and points added.",
			});
			utils.logs.invalidate();
			router.refresh();
		},
		onError: (error) => {
			toast({
				title: "Unable to log task",
				description: error.message ?? "Please try again.",
				variant: "destructive",
			});
		},
	});

	const editablePresets = customPresets.filter((preset) => preset.isShared || preset.createdById === currentUserId);
	const sortedEditablePresets = [...editablePresets].sort((a, b) => {
		return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
	});
	const appliedTemplateKeys = new Set(presetOptions.map((preset) => `${normalizeText(preset.label)}|${preset.bucket}`));
	const templatesByBucket = DURATION_BUCKETS.map((bucket) => ({
		bucket,
		templates: presetTemplates.filter(
			(template) =>
				template.bucket === bucket.key &&
				!appliedTemplateKeys.has(`${normalizeText(template.label)}|${template.bucket}`),
		),
	})).filter((group) => group.templates.length > 0);
	const normalizedQuery = normalizeText(searchQuery);
	const filteredPresets =
		normalizedQuery.length > 0
			? presetOptions.filter((preset) => normalizeText(preset.label).includes(normalizedQuery))
			: presetOptions;

	const handleCreatePresetFromTemplate = async (
		template: PresetTemplate,
		approvalOverride?: "REQUIRE" | "SKIP" | null,
	) => {
		const key = `${normalizeText(template.label)}|${template.bucket}`;
		if (appliedTemplateKeys.has(key)) {
			return false;
		}

		if (!householdId) {
			toast({
				title: "Unable to add preset",
				description: "Household context not available",
				variant: "destructive",
			});
			return false;
		}

		let success = false;
		await new Promise<void>((resolve) =>
			startPresetTransition(async () => {
				try {
					await createPresetMutation.mutateAsync({
						householdId,
						label: template.label,
						bucket: template.bucket,
						isShared: canSharePresets,
						approvalOverride,
					});
					success = true;
					toast({
						title: "Preset added",
						description: "Template added to your presets.",
					});
				} catch {
					// Error handled by mutation onError
				}
				resolve();
			}),
		);
		return success;
	};

	const handleCreatePreset = async (
		label: string,
		bucket: DurationKey,
		approvalOverride?: "REQUIRE" | "SKIP" | null,
	): Promise<boolean> => {
		if (label.trim().length < 2) {
			return false;
		}

		if (!householdId) {
			toast({
				title: "Unable to add preset",
				description: "Household context not available",
				variant: "destructive",
			});
			return false;
		}

		let success = false;
		await new Promise<void>((resolve) =>
			startPresetTransition(async () => {
				try {
					await createPresetMutation.mutateAsync({
						householdId,
						label: label.trim(),
						bucket,
						isShared: canSharePresets,
						approvalOverride,
					});
					success = true;
				} catch {
					// Error handled by mutation onError
				}
				resolve();
			}),
		);

		return success;
	};

	const handleLogTimed = async (label: string, bucket: DurationKey): Promise<boolean> => {
		if (label.trim().length < 2) {
			return false;
		}

		if (!householdId) {
			toast({
				title: "Unable to log task",
				description: "Household context not available",
				variant: "destructive",
			});
			return false;
		}

		return new Promise<boolean>((resolve) => {
			createLogMutation.mutate(
				{
					householdId,
					type: "timed",
					bucket,
					description: label.trim(),
				},
				{
					onSuccess: () => resolve(true),
					onError: () => resolve(false),
				},
			);
		});
	};

	const closeEditDrawer = () => {
		setEditDrawerOpen(false);
	};

	const handleUpdatePreset = async (
		presetId: string,
		label: string,
		bucket: DurationKey,
		approvalOverride?: "REQUIRE" | "SKIP" | null,
	): Promise<boolean> => {
		if (label.trim().length < 2) {
			return false;
		}

		if (!householdId) {
			toast({
				title: "Unable to update preset",
				description: "Household context not available",
				variant: "destructive",
			});
			return false;
		}

		let success = false;
		await new Promise<void>((resolve) =>
			startPresetTransition(async () => {
				try {
					await updatePresetMutation.mutateAsync({
						householdId,
						id: presetId,
						label: label.trim(),
						bucket,
						approvalOverride,
					});
					success = true;
				} catch {
					// Error handled by mutation onError
				}
				resolve();
			}),
		);
		return success;
	};

	const handleDeletePreset = async (presetId: string): Promise<boolean> => {
		if (!householdId) {
			toast({
				title: "Unable to delete preset",
				description: "Household context not available",
				variant: "destructive",
			});
			return false;
		}

		let success = false;
		await new Promise<void>((resolve) =>
			startPresetTransition(async () => {
				try {
					await deletePresetMutation.mutateAsync({ householdId, id: presetId });
					success = true;
				} catch {
					// Error handled by mutation onError
				}
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
							<CardTitle className="text-xl">Tasks</CardTitle>
							<CardDescription>Tap a task once you've completed it.</CardDescription>
						</div>
						<Button type="button" variant="ghost" size="sm" onClick={() => setEditDrawerOpen(true)}>
							Change
						</Button>
					</div>
				</CardHeader>
				<CardContent className="space-y-4">
					<div className="grid gap-2">
						<div className="flex items-center justify-between gap-2">
							<Label htmlFor="task-search">Search tasks</Label>
							<Button
								type="button"
								variant="ghost"
								size="sm"
								onClick={() => setSearchQuery("")}
								disabled={searchQuery.trim().length === 0}
							>
								Clear
							</Button>
						</div>
						<Input
							id="task-search"
							type="search"
							placeholder="Filter tasks by name"
							value={searchQuery}
							onChange={(event) => setSearchQuery(event.target.value)}
						/>
					</div>
					<div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
						{presetOptions.length === 0 ? (
							<p className="text-sm text-muted-foreground sm:col-span-2 lg:col-span-3">No saved tasks yet.</p>
						) : filteredPresets.length === 0 ? (
							<p className="text-sm text-muted-foreground sm:col-span-2 lg:col-span-3">No tasks match that search.</p>
						) : (
							filteredPresets.map((task) => {
								const bucket = DURATION_BUCKETS.find((b) => b.key === task.bucket);
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
				canEditApprovalOverride={canEditApprovalOverride}
			/>
		</>
	);
};
