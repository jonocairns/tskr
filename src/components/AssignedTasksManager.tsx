"use client";

import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";

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
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/Card";
import { Input } from "@/components/ui/Input";
import { Label } from "@/components/ui/Label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/Select";
import { Switch } from "@/components/ui/Switch";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/Table";
import { useToast } from "@/hooks/useToast";
import {
	CADENCE_NONE_VALUE,
	CADENCE_OPTIONS,
	DEFAULT_CADENCE_INTERVAL_MINUTES,
	DEFAULT_CADENCE_TARGET,
} from "@/lib/assignedTasksCadence";
import { trpc } from "@/lib/trpc/react";

const ASSIGNEE_ALL_VALUE = "all";

type AssignedTaskRow = {
	id: string;
	presetLabel: string;
	assigneeId: string | null;
	assigneeName: string | null;
	assigneeEmail: string | null;
	cadenceTarget: number;
	cadenceIntervalMinutes: number;
	isRecurring: boolean;
	assignedAt: string;
};

type Props = {
	initialTasks: AssignedTaskRow[];
};

export const AssignedTasksManager = ({ initialTasks }: Props) => {
	const router = useRouter();
	const { toast } = useToast();
	const [tasks, setTasks] = useState(initialTasks);
	const [assigneeFilter, setAssigneeFilter] = useState(ASSIGNEE_ALL_VALUE);

	useEffect(() => {
		setTasks(initialTasks);
	}, [initialTasks]);

	const assigneeOptions = useMemo(() => {
		const map = new Map<string, { id: string; label: string }>();
		for (const task of tasks) {
			if (!task.assigneeId) {
				continue;
			}
			const label = task.assigneeName ?? task.assigneeEmail ?? "Unknown";
			map.set(task.assigneeId, { id: task.assigneeId, label });
		}
		return Array.from(map.values()).sort((a, b) => a.label.localeCompare(b.label));
	}, [tasks]);

	useEffect(() => {
		if (assigneeFilter === ASSIGNEE_ALL_VALUE) {
			return;
		}
		if (!assigneeOptions.some((option) => option.id === assigneeFilter)) {
			setAssigneeFilter(ASSIGNEE_ALL_VALUE);
		}
	}, [assigneeFilter, assigneeOptions]);

	const sortedTasks = useMemo(
		() => [...tasks].sort((a, b) => new Date(b.assignedAt).getTime() - new Date(a.assignedAt).getTime()),
		[tasks],
	);
	const filteredTasks = useMemo(() => {
		if (assigneeFilter === ASSIGNEE_ALL_VALUE) {
			return sortedTasks;
		}
		return sortedTasks.filter((task) => task.assigneeId === assigneeFilter);
	}, [assigneeFilter, sortedTasks]);

	const updateTask = (
		id: string,
		updates: Partial<Pick<AssignedTaskRow, "cadenceTarget" | "cadenceIntervalMinutes" | "isRecurring">>,
	) => {
		setTasks((prev) => prev.map((task) => (task.id === id ? { ...task, ...updates } : task)));
	};

	const toggleRecurring = (taskId: string, value: boolean) => {
		setTasks((prev) =>
			prev.map((task) => {
				if (task.id !== taskId) {
					return task;
				}
				if (value) {
					return {
						...task,
						isRecurring: true,
					};
				}
				return {
					...task,
					isRecurring: false,
					cadenceTarget: DEFAULT_CADENCE_TARGET,
					cadenceIntervalMinutes: DEFAULT_CADENCE_INTERVAL_MINUTES,
				};
			}),
		);
	};

	const updateMutation = trpc.assignedTasks.update.useMutation({
		onSuccess: (result, variables) => {
			updateTask(variables.id, {
				cadenceTarget: result.assignedTask.cadenceTarget,
				cadenceIntervalMinutes: result.assignedTask.cadenceIntervalMinutes,
				isRecurring: result.assignedTask.isRecurring,
			});
			toast({ title: "Assigned task updated" });
			router.refresh();
		},
		onError: (error) => {
			toast({
				title: "Unable to update task",
				description: error.message ?? "Please try again.",
				variant: "destructive",
			});
		},
	});

	const deleteMutation = trpc.assignedTasks.delete.useMutation({
		onSuccess: (_, variables) => {
			setTasks((prev) => prev.filter((task) => task.id !== variables.id));
			toast({ title: "Assigned task deleted" });
			router.refresh();
		},
		onError: (error) => {
			toast({
				title: "Unable to delete task",
				description: error.message ?? "Please try again.",
				variant: "destructive",
			});
		},
	});

	const handleSave = (taskId: string) => {
		const task = tasks.find((item) => item.id === taskId);
		if (!task) {
			return;
		}

		const cadenceTarget = task.isRecurring ? Math.max(1, Math.floor(task.cadenceTarget || 1)) : DEFAULT_CADENCE_TARGET;
		const cadenceIntervalMinutes = task.isRecurring
			? Math.max(1, task.cadenceIntervalMinutes || 1)
			: DEFAULT_CADENCE_INTERVAL_MINUTES;

		updateMutation.mutate({
			id: taskId,
			cadenceTarget,
			cadenceIntervalMinutes,
			isRecurring: task.isRecurring,
		});
	};

	const handleDelete = (taskId: string) => {
		deleteMutation.mutate({ id: taskId });
	};

	const isPending = updateMutation.isPending || deleteMutation.isPending;

	return (
		<Card>
			<CardHeader className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
				<div className="space-y-1">
					<CardTitle className="text-xl">Assigned tasks</CardTitle>
					<CardDescription>Manage assigned tasks across the household.</CardDescription>
				</div>
				{sortedTasks.length > 0 ? (
					<div className="sm:min-w-[220px]">
						<Select value={assigneeFilter} onValueChange={setAssigneeFilter} disabled={isPending}>
							<SelectTrigger aria-label="Filter by assignee">
								<SelectValue placeholder="All assignees" />
							</SelectTrigger>
							<SelectContent>
								<SelectItem value={ASSIGNEE_ALL_VALUE}>All assignees</SelectItem>
								{assigneeOptions.map((option) => (
									<SelectItem key={option.id} value={option.id}>
										{option.label}
									</SelectItem>
								))}
							</SelectContent>
						</Select>
					</div>
				) : null}
			</CardHeader>
			<CardContent className="overflow-x-auto">
				{sortedTasks.length === 0 ? (
					<p className="text-sm text-muted-foreground">No assigned tasks yet.</p>
				) : (
					<Table>
						<TableHeader>
							<TableRow>
								<TableHead>Task</TableHead>
								<TableHead>Assignee</TableHead>
								<TableHead>Recurring</TableHead>
								<TableHead>Cadence</TableHead>
								<TableHead>Completions</TableHead>
								<TableHead className="text-right">Actions</TableHead>
							</TableRow>
						</TableHeader>
						<TableBody>
							{filteredTasks.map((task) => (
								<TableRow key={task.id}>
									<TableCell>
										<span className="font-semibold">{task.presetLabel}</span>
									</TableCell>
									<TableCell>
										<div className="flex flex-col">
											<span className="text-sm">{task.assigneeName ?? task.assigneeEmail ?? "Unknown"}</span>
											<span className="text-xs text-muted-foreground">{task.assigneeEmail ?? "—"}</span>
										</div>
									</TableCell>
									<TableCell>
										<Switch
											checked={task.isRecurring}
											onCheckedChange={(value) => toggleRecurring(task.id, value)}
											disabled={isPending}
											aria-label="Recurring"
										/>
									</TableCell>
									<TableCell>
										<Select
											value={task.isRecurring ? String(task.cadenceIntervalMinutes) : CADENCE_NONE_VALUE}
											onValueChange={(value) => {
												if (value === CADENCE_NONE_VALUE) {
													toggleRecurring(task.id, false);
													return;
												}
												updateTask(task.id, {
													cadenceIntervalMinutes: Number.parseInt(value, 10),
													isRecurring: true,
												});
											}}
											disabled={isPending || !task.isRecurring}
										>
											<SelectTrigger aria-label="Cadence">
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
									</TableCell>
									<TableCell>
										<div className="grid gap-2">
											<Label className="sr-only" htmlFor={`cadence-${task.id}`}>
												Completions per cycle
											</Label>
											<Input
												id={`cadence-${task.id}`}
												type="number"
												min={1}
												value={task.isRecurring ? task.cadenceTarget : DEFAULT_CADENCE_TARGET}
												onChange={(event) =>
													updateTask(task.id, {
														cadenceTarget: Number.parseInt(event.target.value, 10) || 1,
													})
												}
												disabled={isPending || !task.isRecurring}
											/>
										</div>
									</TableCell>
									<TableCell className="text-right">
										<div className="flex justify-end gap-2">
											<Button type="button" size="sm" disabled={isPending} onClick={() => handleSave(task.id)}>
												Save
											</Button>
											<AlertDialog>
												<AlertDialogTrigger asChild>
													<Button type="button" size="sm" variant="outline" disabled={isPending}>
														Delete
													</Button>
												</AlertDialogTrigger>
												<AlertDialogContent>
													<AlertDialogHeader>
														<AlertDialogTitle>Delete assigned task?</AlertDialogTitle>
														<AlertDialogDescription>
															This removes the task from the queue. Existing completions stay in the log.
														</AlertDialogDescription>
													</AlertDialogHeader>
													<AlertDialogFooter>
														<AlertDialogCancel>Cancel</AlertDialogCancel>
														<AlertDialogAction
															type="button"
															onClick={() => handleDelete(task.id)}
															className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
														>
															Delete
														</AlertDialogAction>
													</AlertDialogFooter>
												</AlertDialogContent>
											</AlertDialog>
										</div>
									</TableCell>
								</TableRow>
							))}
						</TableBody>
					</Table>
				)}
			</CardContent>
		</Card>
	);
};
