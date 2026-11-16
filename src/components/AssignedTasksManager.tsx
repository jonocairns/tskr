"use client";

import { Loader2Icon, Trash2Icon } from "lucide-react";
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
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/Table";
import { useToast } from "@/hooks/useToast";
import {
	CADENCE_NONE_VALUE,
	CADENCE_OPTIONS,
	DEFAULT_CADENCE_INTERVAL_MINUTES,
	DEFAULT_CADENCE_TARGET,
	formatCadenceOption,
	formatCadenceTargetLabel,
} from "@/lib/assignedTasksCadence";
import { useTranslation } from "@/lib/i18nClient";
import { trpc } from "@/lib/trpc/react";
import { cn } from "@/lib/utils";

const UNASSIGNED_VALUE = "unassigned";

const ASSIGNEE_ALL_VALUE = "all";

type AssignedTaskRow = {
	id: string;
	presetId: string;
	presetLabel: string;
	assigneeId: string | null;
	assigneeName: string | null;
	assigneeEmail: string | null;
	cadenceTarget: number;
	cadenceIntervalMinutes: number;
	isRecurring: boolean;
	assignedAt: string;
	progress: { completed: number; target: number; isRecurring: boolean };
};

type Props = {
	householdId: string;
	initialTasks: AssignedTaskRow[];
	members: Array<{ id: string; name: string | null; email: string | null }>;
	highlightTaskId?: string | null;
};

export const AssignedTasksManager = ({ householdId, initialTasks, members, highlightTaskId }: Props) => {
	const router = useRouter();
	const { toast } = useToast();
	const { t } = useTranslation();
	const [tasks, setTasks] = useState(initialTasks);
	// The last saved values, so Save only enables for rows with unsaved changes.
	const [savedTasks, setSavedTasks] = useState(initialTasks);
	const [assigneeFilter, setAssigneeFilter] = useState(ASSIGNEE_ALL_VALUE);

	useEffect(() => {
		setTasks(initialTasks);
		setSavedTasks(initialTasks);
	}, [initialTasks]);

	const savedById = useMemo(() => new Map(savedTasks.map((task) => [task.id, task])), [savedTasks]);
	const isCadenceDirty = (task: AssignedTaskRow) => {
		const saved = savedById.get(task.id);
		if (!saved) {
			return false;
		}
		if (saved.isRecurring !== task.isRecurring) {
			return true;
		}
		return (
			task.isRecurring &&
			(saved.cadenceIntervalMinutes !== task.cadenceIntervalMinutes || saved.cadenceTarget !== task.cadenceTarget)
		);
	};
	const isDirty = (task: AssignedTaskRow) =>
		isCadenceDirty(task) || savedById.get(task.id)?.assigneeId !== task.assigneeId;

	const assigneeOptions = useMemo(() => {
		const map = new Map<string, { id: string; label: string }>();
		for (const task of tasks) {
			if (!task.assigneeId) {
				continue;
			}
			const label = task.assigneeName ?? task.assigneeEmail ?? t("Unknown");
			map.set(task.assigneeId, { id: task.assigneeId, label });
		}
		return Array.from(map.values()).sort((a, b) => a.label.localeCompare(b.label));
	}, [tasks, t]);

	useEffect(() => {
		if (assigneeFilter === ASSIGNEE_ALL_VALUE || assigneeFilter === UNASSIGNED_VALUE) {
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
		return sortedTasks.filter((task) => (task.assigneeId ?? UNASSIGNED_VALUE) === assigneeFilter);
	}, [assigneeFilter, sortedTasks]);

	const updateTask = (
		id: string,
		updates: Partial<
			Pick<
				AssignedTaskRow,
				"cadenceTarget" | "cadenceIntervalMinutes" | "isRecurring" | "assigneeId" | "assigneeName" | "assigneeEmail"
			>
		>,
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
			const member = members.find((item) => item.id === result.assignedTask.assignedToId);
			const updates = {
				assigneeId: result.assignedTask.assignedToId,
				assigneeName: member?.name ?? null,
				assigneeEmail: member?.email ?? null,
				cadenceTarget: result.assignedTask.cadenceTarget,
				cadenceIntervalMinutes: result.assignedTask.cadenceIntervalMinutes,
				isRecurring: result.assignedTask.isRecurring,
			};
			updateTask(variables.id, updates);
			setSavedTasks((prev) => prev.map((task) => (task.id === variables.id ? { ...task, ...updates } : task)));
			toast({ title: t("Task updated") });
			router.refresh();
		},
		onError: (error) => {
			toast({
				title: t("Unable to update task"),
				description: error.message ?? t("Please try again."),
				variant: "destructive",
			});
		},
	});

	const deleteMutation = trpc.assignedTasks.delete.useMutation({
		onMutate: async (variables) => {
			const previousTasks = tasks;
			setTasks((prev) => prev.filter((task) => task.id !== variables.id));
			return { previousTasks };
		},
		onError: (error, _variables, context) => {
			if (context?.previousTasks) {
				setTasks(context.previousTasks);
			}
			toast({
				title: t("Unable to remove task"),
				description: error.message ?? t("Please try again."),
				variant: "destructive",
			});
		},
		onSuccess: () => {
			toast({ title: t("Task removed") });
			router.refresh();
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
			householdId,
			id: taskId,
			cadenceTarget,
			cadenceIntervalMinutes,
			isRecurring: task.isRecurring,
			assigneeId: task.assigneeId,
		});
	};

	const handleDelete = (taskId: string) => {
		deleteMutation.mutate({ householdId, id: taskId });
	};

	const isPending = updateMutation.isPending || deleteMutation.isPending;
	const savingTaskId = updateMutation.isPending ? updateMutation.variables?.id : undefined;

	// Progress reflects the saved schedule, so an unsaved schedule change would contradict it.
	const formatProgress = (task: AssignedTaskRow) =>
		isCadenceDirty(task)
			? t("Save to update progress")
			: task.progress.isRecurring
				? t("{{completed}}/{{target}} this cycle", {
						completed: task.progress.completed,
						target: task.progress.target,
					})
				: t("{{completed}}/{{target}} completed", {
						completed: task.progress.completed,
						target: task.progress.target,
					});

	const highlightClass = (task: AssignedTaskRow) =>
		task.id === highlightTaskId
			? "animate-row-highlight motion-reduce:animate-none motion-reduce:bg-emerald-500/15"
			: undefined;

	const renderAssignee = (task: AssignedTaskRow, id?: string) => (
		<Select
			value={task.assigneeId ?? UNASSIGNED_VALUE}
			onValueChange={(value) => {
				// A draft like the cadence fields, saved with the row so neither edit discards the other.
				const member = members.find((item) => item.id === value);
				updateTask(task.id, {
					assigneeId: member?.id ?? null,
					assigneeName: member?.name ?? null,
					assigneeEmail: member?.email ?? null,
				});
			}}
			disabled={isPending}
		>
			<SelectTrigger id={id} aria-label={id ? undefined : t("Assignee for {{task}}", { task: task.presetLabel })}>
				<SelectValue>
					{task.assigneeId === null ? t("Open") : (task.assigneeName ?? task.assigneeEmail ?? t("Unknown"))}
				</SelectValue>
			</SelectTrigger>
			<SelectContent>
				<SelectItem value={UNASSIGNED_VALUE}>{t("Open")}</SelectItem>
				{members.map((member) => (
					<SelectItem key={member.id} value={member.id}>
						{member.name ?? member.email ?? t("Unknown")}
					</SelectItem>
				))}
			</SelectContent>
		</Select>
	);

	const renderRepeats = (task: AssignedTaskRow, id?: string) => (
		<Select
			value={task.isRecurring ? String(task.cadenceIntervalMinutes) : CADENCE_NONE_VALUE}
			onValueChange={(value) => {
				if (!value) {
					return;
				}
				if (value === CADENCE_NONE_VALUE) {
					toggleRecurring(task.id, false);
					return;
				}
				updateTask(task.id, {
					cadenceIntervalMinutes: Number.parseInt(value, 10),
					isRecurring: true,
				});
			}}
			disabled={isPending}
		>
			<SelectTrigger id={id} aria-label={id ? undefined : t("Repeats for {{task}}", { task: task.presetLabel })}>
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
	);

	const renderTarget = (task: AssignedTaskRow, id: string, className?: string) => (
		<Input
			id={id}
			type="number"
			inputMode="numeric"
			min={1}
			className={className}
			value={task.cadenceTarget}
			onChange={(event) =>
				updateTask(task.id, {
					cadenceTarget: Number.parseInt(event.target.value, 10) || 1,
				})
			}
			disabled={isPending}
		/>
	);

	const renderActions = (task: AssignedTaskRow) => {
		const dirty = isDirty(task);
		return (
			<div className="-mr-2 flex items-center justify-end gap-1 md:mr-0">
				<Button
					type="button"
					size="sm"
					variant={dirty ? "default" : "ghost"}
					disabled={isPending || !dirty}
					onClick={() => handleSave(task.id)}
					aria-label={t("Save {{task}}", { task: task.presetLabel })}
					className={cn("h-9 w-16", !dirty && "invisible")}
				>
					{savingTaskId === task.id ? <Loader2Icon className="h-4 w-4 animate-spin" /> : t("Save")}
				</Button>
				<AlertDialog>
					<AlertDialogTrigger asChild>
						<Button
							type="button"
							size="icon"
							variant="ghost"
							disabled={isPending}
							aria-label={t("Remove {{task}}", { task: task.presetLabel })}
							className="h-9 w-9 text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
						>
							<Trash2Icon className="h-4 w-4" />
						</Button>
					</AlertDialogTrigger>
					<AlertDialogContent>
						<AlertDialogHeader>
							<AlertDialogTitle>{t("Remove task?")}</AlertDialogTitle>
							<AlertDialogDescription>
								{t("This removes the task from the list. Its completions stay in Done.")}
							</AlertDialogDescription>
						</AlertDialogHeader>
						<AlertDialogFooter>
							<AlertDialogCancel>{t("Cancel")}</AlertDialogCancel>
							<AlertDialogAction
								type="button"
								onClick={() => handleDelete(task.id)}
								className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
							>
								{t("Remove")}
							</AlertDialogAction>
						</AlertDialogFooter>
					</AlertDialogContent>
				</AlertDialog>
			</div>
		);
	};

	return (
		<Card>
			<CardHeader className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
				<div className="space-y-1">
					<CardTitle className="text-xl">{t("All tasks")}</CardTitle>
					<CardDescription>{t("Change who does a task and how often, then save the row.")}</CardDescription>
				</div>
				{sortedTasks.length > 0 ? (
					<div className="sm:min-w-[220px]">
						<Select value={assigneeFilter} onValueChange={setAssigneeFilter} disabled={isPending}>
							<SelectTrigger aria-label={t("Filter by assignee")}>
								<SelectValue placeholder={t("All assignees")} />
							</SelectTrigger>
							<SelectContent>
								<SelectItem value={ASSIGNEE_ALL_VALUE}>{t("All assignees")}</SelectItem>
								<SelectItem value={UNASSIGNED_VALUE}>{t("Open")}</SelectItem>
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
			<CardContent>
				{sortedTasks.length === 0 ? (
					<p className="text-sm text-muted-foreground">{t("No tasks yet.")}</p>
				) : (
					<>
						<div className="hidden md:block">
							<Table>
								<TableHeader>
									<TableRow>
										<TableHead>{t("Task")}</TableHead>
										<TableHead className="w-48">{t("Assignee")}</TableHead>
										<TableHead className="w-44">{t("Repeats")}</TableHead>
										<TableHead className="w-24">{t("Per period")}</TableHead>
										<TableHead className="w-32">{t("Progress")}</TableHead>
										<TableHead className="w-28 text-right">
											<span className="sr-only">{t("Actions")}</span>
										</TableHead>
									</TableRow>
								</TableHeader>
								{/* Solid control backgrounds so row hover and highlight tints don't wash them out. */}
								<TableBody className="[&_button[role=combobox]]:bg-card [&_input]:bg-card">
									{filteredTasks.map((task) => (
										<TableRow key={task.id} className={highlightClass(task)}>
											<TableCell>
												<span className="font-semibold">{task.presetLabel}</span>
											</TableCell>
											<TableCell>{renderAssignee(task)}</TableCell>
											<TableCell>{renderRepeats(task)}</TableCell>
											<TableCell>
												{task.isRecurring ? (
													<>
														<Label className="sr-only" htmlFor={`cadence-${task.id}`}>
															{formatCadenceTargetLabel(task.cadenceIntervalMinutes, t)}
														</Label>
														{renderTarget(task, `cadence-${task.id}`, "w-20")}
													</>
												) : (
													<>
														<span className="text-muted-foreground" aria-hidden="true">
															—
														</span>
														<span className="sr-only">{t("Does not repeat")}</span>
													</>
												)}
											</TableCell>
											<TableCell
												className={cn(
													"text-muted-foreground",
													isCadenceDirty(task) ? "text-xs leading-tight" : "whitespace-nowrap",
												)}
											>
												{formatProgress(task)}
											</TableCell>
											<TableCell>{renderActions(task)}</TableCell>
										</TableRow>
									))}
								</TableBody>
							</Table>
						</div>
						<ul className="divide-y md:hidden">
							{filteredTasks.map((task) => (
								<li
									key={task.id}
									className={cn(
										"grid gap-3 py-4 [&_button[role=combobox]]:bg-card [&_input]:bg-card",
										task.id === highlightTaskId && "-mx-2 rounded-md px-2",
										highlightClass(task),
									)}
								>
									<div className="flex items-start justify-between gap-3">
										<div className="min-w-0">
											<p className="font-semibold">{task.presetLabel}</p>
											<p className="text-sm text-muted-foreground">{formatProgress(task)}</p>
										</div>
										{renderActions(task)}
									</div>
									<div className="grid grid-cols-[minmax(0,1fr)_7rem] gap-4">
										<div className="col-span-2 grid gap-2">
											<Label htmlFor={`m-assignee-${task.id}`}>{t("Assignee")}</Label>
											{renderAssignee(task, `m-assignee-${task.id}`)}
										</div>
										<div className={cn("grid content-start gap-2", !task.isRecurring && "col-span-2")}>
											<Label htmlFor={`m-repeats-${task.id}`}>{t("Repeats")}</Label>
											{renderRepeats(task, `m-repeats-${task.id}`)}
										</div>
										{task.isRecurring ? (
											<div className="grid content-start gap-2">
												<Label htmlFor={`m-cadence-${task.id}`} className="whitespace-nowrap">
													{formatCadenceTargetLabel(task.cadenceIntervalMinutes, t)}
												</Label>
												{renderTarget(task, `m-cadence-${task.id}`)}
											</div>
										) : null}
									</div>
								</li>
							))}
						</ul>
					</>
				)}
			</CardContent>
		</Card>
	);
};
