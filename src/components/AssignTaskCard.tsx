"use client";

import { useRouter } from "next/navigation";
import { type FormEvent, useEffect, useMemo, useState } from "react";

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
import { trpc } from "@/lib/trpc/react";

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

	const sortedMembers = useMemo(
		() => [...members].sort((a, b) => (a.name ?? a.email ?? "").localeCompare(b.name ?? b.email ?? "")),
		[members],
	);
	const sortedPresets = useMemo(() => [...presets].sort((a, b) => a.label.localeCompare(b.label)), [presets]);

	const [assigneeId, setAssigneeId] = useState(currentUserId);
	const [presetId, setPresetId] = useState(sortedPresets[0]?.id ?? "");
	const [cadenceTarget, setCadenceTarget] = useState(DEFAULT_CADENCE_TARGET);
	const [cadenceInterval, setCadenceInterval] = useState(String(DEFAULT_CADENCE_INTERVAL_MINUTES));
	const [isRecurring, setIsRecurring] = useState(true);

	useEffect(() => {
		if (!sortedPresets.find((preset) => preset.id === presetId)) {
			setPresetId(sortedPresets[0]?.id ?? "");
		}
	}, [presetId, sortedPresets]);

	useEffect(() => {
		if (!sortedMembers.find((member) => member.id === assigneeId)) {
			setAssigneeId(sortedMembers[0]?.id ?? currentUserId);
		}
	}, [assigneeId, currentUserId, sortedMembers]);

	const createMutation = trpc.assignedTasks.create.useMutation({
		onSuccess: () => {
			toast({
				title: "Assigned task created",
				description: "The task is now in the queue.",
			});
			router.refresh();
		},
		onError: (error) => {
			toast({
				title: "Unable to assign task",
				description: error.message ?? "Please try again.",
				variant: "destructive",
			});
		},
	});

	const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
		event.preventDefault();
		if (!presetId || !assigneeId) {
			toast({
				title: "Missing details",
				description: "Pick a member and preset to assign.",
				variant: "destructive",
			});
			return;
		}

		const cadenceTargetValue = isRecurring ? Math.max(1, Math.floor(cadenceTarget || 1)) : DEFAULT_CADENCE_TARGET;
		const cadenceIntervalMinutes = isRecurring
			? Math.max(1, Number.parseInt(cadenceInterval, 10) || 1)
			: DEFAULT_CADENCE_INTERVAL_MINUTES;

		createMutation.mutate({
			householdId,
			presetId,
			assigneeId,
			cadenceTarget: cadenceTargetValue,
			cadenceIntervalMinutes,
			isRecurring,
		});
	};

	const disabled = createMutation.isPending || sortedMembers.length === 0 || sortedPresets.length === 0;

	return (
		<Card>
			<CardHeader>
				<CardTitle className="text-xl">Assign task</CardTitle>
				<CardDescription>Send a preset task to someone's queue.</CardDescription>
			</CardHeader>
			<CardContent>
				{sortedPresets.length === 0 ? (
					<p className="text-sm text-muted-foreground">Create a preset chore before assigning tasks.</p>
				) : (
					<form className="grid gap-4" onSubmit={handleSubmit}>
						<div className="grid gap-4 md:grid-cols-2">
							<div className="grid gap-2">
								<Label htmlFor="assignee">Assignee</Label>
								<Select value={assigneeId} onValueChange={setAssigneeId} disabled={disabled}>
									<SelectTrigger id="assignee">
										<SelectValue placeholder="Select member" />
									</SelectTrigger>
									<SelectContent>
										{sortedMembers.map((member) => (
											<SelectItem key={member.id} value={member.id}>
												{member.name ?? member.email ?? "Unknown"}
											</SelectItem>
										))}
									</SelectContent>
								</Select>
							</div>
							<div className="grid gap-2">
								<Label htmlFor="preset">Preset</Label>
								<Select value={presetId} onValueChange={setPresetId} disabled={disabled}>
									<SelectTrigger id="preset">
										<SelectValue placeholder="Select preset" />
									</SelectTrigger>
									<SelectContent>
										{sortedPresets.map((preset) => (
											<SelectItem key={preset.id} value={preset.id}>
												{preset.label}
											</SelectItem>
										))}
									</SelectContent>
								</Select>
							</div>
						</div>
						<div className="grid gap-4 md:grid-cols-2">
							<div className="flex items-center justify-between gap-2 rounded-md border border-input px-3 py-2 md:col-span-2">
								<div className="space-y-1">
									<Label htmlFor="recurring">Recurring</Label>
									<p className="text-xs text-muted-foreground">Reset after each cadence cycle.</p>
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
										<Label htmlFor="cadence-interval">Cadence</Label>
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
												<SelectValue placeholder="Select cadence" />
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
										<Label htmlFor="cadence-target">Completions per cycle</Label>
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
							Assign task
						</Button>
					</form>
				)}
			</CardContent>
		</Card>
	);
};
