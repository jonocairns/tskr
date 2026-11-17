"use client";

import { CheckIcon, Loader2Icon, Trash2Icon } from "lucide-react";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

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
const SAVED_CONFIRMATION_MS = 1500;
const FOCUS_HEADING = "__heading__";

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

type DraftFields = Pick<
	AssignedTaskRow,
	"assigneeId" | "assigneeName" | "assigneeEmail" | "isRecurring" | "cadenceIntervalMinutes" | "cadenceTarget"
>;

const hasDraftChanges = (draft: AssignedTaskRow, saved: AssignedTaskRow) =>
	draft.assigneeId !== saved.assigneeId ||
	draft.isRecurring !== saved.isRecurring ||
	(draft.isRecurring &&
		(draft.cadenceIntervalMinutes !== saved.cadenceIntervalMinutes || draft.cadenceTarget !== saved.cadenceTarget));

const pickDraftFields = (task: AssignedTaskRow): DraftFields => ({
	assigneeId: task.assigneeId,
	assigneeName: task.assigneeName,
	assigneeEmail: task.assigneeEmail,
	isRecurring: task.isRecurring,
	cadenceIntervalMinutes: task.cadenceIntervalMinutes,
	cadenceTarget: task.cadenceTarget,
});

// Desktop and mobile layouts both render; only one is displayed at a time.
const findVisible = (selector: string) =>
	Array.from(document.querySelectorAll<HTMLElement>(selector)).find((element) => element.offsetParent !== null);

const focusTaskRow = (taskId: string) =>
	findVisible(`[data-task-id="${taskId}"]`)
		?.querySelector<HTMLElement>("button[role=combobox]")
		?.focus({ preventScroll: true });

// Focus is "in" a row when it is inside the row or inside a popup (select list, dialog) opened by one of the
// row's own controls, which Radix portals elsewhere but links through aria-controls.
const isRowInUse = (taskId: string) => {
	const row = findVisible(`[data-task-id="${taskId}"]`);
	const active = document.activeElement;
	if (!row || !active || active === document.body) {
		return false;
	}
	if (row.contains(active)) {
		return true;
	}
	return Array.from(row.querySelectorAll<HTMLElement>("[aria-controls]")).some((trigger) => {
		const controlled = trigger.getAttribute("aria-controls");
		return controlled ? document.getElementById(controlled)?.contains(active) : false;
	});
};

const prefersReducedMotion = () => window.matchMedia("(prefers-reduced-motion: reduce)").matches;

type Props = {
	householdId: string;
	initialTasks: AssignedTaskRow[];
	members: Array<{ id: string; name: string | null; email: string | null }>;
	highlightTaskId?: string | null;
	revealRequest?: { id: string; count: number } | null;
};

export const AssignedTasksManager = ({ householdId, initialTasks, members, highlightTaskId, revealRequest }: Props) => {
	const router = useRouter();
	const { toast } = useToast();
	const { t } = useTranslation();
	const [tasks, setTasks] = useState(initialTasks);
	// The last saved values, so Save only enables for rows with unsaved changes.
	const [savedTasks, setSavedTasks] = useState(initialTasks);
	const [assigneeFilter, setAssigneeFilter] = useState(ASSIGNEE_ALL_VALUE);
	const [savedConfirmation, setSavedConfirmation] = useState<{ id: string; count: number } | null>(null);
	// Screen readers don't reliably announce a focused button's label change, so outcomes are also announced here.
	// Keyed by count so an identical message (e.g. saving the same row twice) is re-announced.
	const [announcement, setAnnouncement] = useState({ text: "", count: 0 });
	const showAllRef = useRef<HTMLButtonElement>(null);
	const headingRef = useRef<HTMLDivElement>(null);
	// After a removal, focus goes to a neighbouring row (or the heading), since the dialog and its trigger unmount.
	const [focusAfterRemove, setFocusAfterRemove] = useState<{ removedId: string; targetId: string } | null>(null);
	const savedTasksRef = useRef(savedTasks);

	useEffect(() => {
		savedTasksRef.current = savedTasks;
	}, [savedTasks]);

	// Server refreshes (after adding, saving or removing) keep other rows' unsaved edits instead of discarding them.
	useEffect(() => {
		const previousSaved = new Map(savedTasksRef.current.map((task) => [task.id, task]));
		setTasks((drafts) => {
			const draftsById = new Map(drafts.map((task) => [task.id, task]));
			return initialTasks.map((next) => {
				const draft = draftsById.get(next.id);
				const saved = previousSaved.get(next.id);
				return draft && saved && hasDraftChanges(draft, saved) ? { ...next, ...pickDraftFields(draft) } : next;
			});
		});
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

	// Options follow saved assignees, matching how rows are filtered, so unsaved edits don't change them.
	const assigneeOptions = useMemo(() => {
		const map = new Map<string, { id: string; label: string }>();
		for (const task of savedTasks) {
			if (!task.assigneeId) {
				continue;
			}
			const label = task.assigneeName ?? task.assigneeEmail ?? t("Unknown");
			map.set(task.assigneeId, { id: task.assigneeId, label });
		}
		// The selected assignee stays available after their last task is reassigned, so the filter doesn't
		// silently jump to everyone; the empty state offers the way out instead.
		const selected = members.find((member) => member.id === assigneeFilter);
		if (selected && !map.has(selected.id)) {
			map.set(selected.id, { id: selected.id, label: selected.name ?? selected.email ?? t("Unknown") });
		}
		return Array.from(map.values()).sort((a, b) => a.label.localeCompare(b.label));
	}, [assigneeFilter, members, savedTasks, t]);

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
	// Filter on the saved assignee, so reassigning a row doesn't hide it before it is saved.
	const matchesFilter = (task: AssignedTaskRow) =>
		assigneeFilter === ASSIGNEE_ALL_VALUE ||
		((savedById.get(task.id) ?? task).assigneeId ?? UNASSIGNED_VALUE) === assigneeFilter;
	// A row saved out of the current filter stays until the user is done with it: no "Saved" confirmation is
	// showing for it, focus isn't in it (popups and dialogs it opened count as inside), it has no new unsaved
	// edits, and the last click wasn't on it. Several rows can be retained at once; they are released together
	// in one sweep, so the table reflows once rather than under each click.
	const [stickyRowIds, setStickyRowIds] = useState<ReadonlySet<string>>(() => new Set());
	const filteredTasks = sortedTasks.filter((task) => matchesFilter(task) || stickyRowIds.has(task.id));
	const latestRef = useRef({ tasks, isDirty, savedConfirmation, stickyRowIds });
	useEffect(() => {
		latestRef.current = { tasks, isDirty, savedConfirmation, stickyRowIds };
	});
	const sweepStickyRows = useCallback((pressTarget: EventTarget | null) => {
		const { tasks: current, isDirty: dirty, savedConfirmation: confirming, stickyRowIds: sticky } = latestRef.current;
		// An open dropdown or dialog would shift if rows above it left; its closing moves focus and sweeps again.
		if (sticky.size === 0 || document.querySelector("[data-radix-popper-content-wrapper], [role=alertdialog]")) {
			return;
		}
		const released = [...sticky].filter((taskId) => {
			const row = current.find((task) => task.id === taskId);
			const pressedInRow =
				pressTarget instanceof Node && findVisible(`[data-task-id="${taskId}"]`)?.contains(pressTarget);
			return confirming?.id !== taskId && !(row && dirty(row)) && !pressedInRow && !isRowInUse(taskId);
		});
		if (released.length > 0) {
			setStickyRowIds((previous) => new Set([...previous].filter((taskId) => !released.includes(taskId))));
		}
	}, []);
	// Sweeps run after a click completes and after focus moves. Removing rows mid-click would shift the rows
	// below between pointerdown and pointerup, so nothing is released while a pointer is pressed; the click
	// event follows pointerup in the same task, so a zero timeout lets it land first.
	const pointerDownRef = useRef(false);
	useEffect(() => {
		let pressTarget: EventTarget | null = null;
		const down = (event: PointerEvent) => {
			pointerDownRef.current = true;
			pressTarget = event.target;
		};
		const up = () => {
			pointerDownRef.current = false;
			const target = pressTarget;
			setTimeout(() => sweepStickyRows(target), 0);
		};
		const focusMoved = () => {
			if (!pointerDownRef.current) {
				setTimeout(() => sweepStickyRows(null), 0);
			}
		};
		document.addEventListener("pointerdown", down, true);
		document.addEventListener("pointerup", up, true);
		document.addEventListener("pointercancel", up, true);
		document.addEventListener("focusin", focusMoved);
		return () => {
			document.removeEventListener("pointerdown", down, true);
			document.removeEventListener("pointerup", up, true);
			document.removeEventListener("pointercancel", up, true);
			document.removeEventListener("focusin", focusMoved);
		};
	}, [sweepStickyRows]);

	// A just-added row hidden by the assignee filter would make the confirmation point at nothing. This runs
	// once per added row, so a filter chosen afterwards still applies.
	const autoRevealedIdRef = useRef<string | null>(null);
	useEffect(() => {
		if (
			!highlightTaskId ||
			highlightTaskId === autoRevealedIdRef.current ||
			!tasks.some((task) => task.id === highlightTaskId)
		) {
			return;
		}
		autoRevealedIdRef.current = highlightTaskId;
		if (!filteredTasks.some((task) => task.id === highlightTaskId)) {
			setAssigneeFilter(ASSIGNEE_ALL_VALUE);
			setAnnouncement((previous) => ({
				text: t("Showing all assignees so the new task is visible."),
				count: previous.count + 1,
			}));
		}
	}, [filteredTasks, highlightTaskId, t, tasks]);

	// "View" from the add form scrolls to the row and focuses it. The request waits for the row if the
	// refreshed list hasn't arrived yet.
	const [pendingRevealId, setPendingRevealId] = useState<string | null>(null);
	useEffect(() => {
		if (revealRequest) {
			setAssigneeFilter(ASSIGNEE_ALL_VALUE);
			setPendingRevealId(revealRequest.id);
		}
	}, [revealRequest]);
	useEffect(() => {
		if (!pendingRevealId || !tasks.some((task) => task.id === pendingRevealId)) {
			return;
		}
		requestAnimationFrame(() => {
			const row = findVisible(`[data-task-id="${pendingRevealId}"]`);
			row?.scrollIntoView({ block: "center", behavior: prefersReducedMotion() ? "auto" : "smooth" });
			row?.querySelector<HTMLElement>("button[role=combobox]")?.focus({ preventScroll: true });
			setPendingRevealId(null);
		});
	}, [pendingRevealId, tasks]);

	// "Saved" holds the button in place briefly, then hands focus to the row so keyboard users keep their place.
	// Its end also sweeps retained rows, including any whose confirmation a later save replaced.
	useEffect(() => {
		if (!savedConfirmation) {
			return;
		}
		const timeout = setTimeout(() => {
			const { id } = savedConfirmation;
			const active = document.activeElement;
			latestRef.current = { ...latestRef.current, savedConfirmation: null };
			setSavedConfirmation(null);
			// Save reverts to hidden, so focus on it moves to the row's first control and the row stays.
			if (active instanceof HTMLElement && active.dataset.saveFor === id) {
				focusTaskRow(id);
				return;
			}
			if (!pointerDownRef.current) {
				sweepStickyRows(null);
			}
		}, SAVED_CONFIRMATION_MS);
		return () => clearTimeout(timeout);
	}, [savedConfirmation, sweepStickyRows]);

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
				// The schedule fields stay in the draft so switching back restores them.
				return { ...task, isRecurring: false };
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
			setSavedConfirmation((previous) => ({ id: variables.id, count: (previous?.count ?? 0) + 1 }));
			const label = tasks.find((task) => task.id === variables.id)?.presetLabel ?? t("Task");
			const leavesFilter =
				assigneeFilter !== ASSIGNEE_ALL_VALUE && (updates.assigneeId ?? UNASSIGNED_VALUE) !== assigneeFilter;
			// Only a row the save moves out of the filter needs retaining.
			if (leavesFilter) {
				setStickyRowIds((sticky) => new Set(sticky).add(variables.id));
			}
			setAnnouncement((previous) => ({
				text: leavesFilter
					? t("{{task}} saved. It no longer matches the assignee filter.", { task: label })
					: t("{{task}} saved.", { task: label }),
				count: previous.count + 1,
			}));
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
			// The row is back, so focus returns to it instead of a neighbour.
			setFocusAfterRemove((pending) => pending && { removedId: "", targetId: pending.removedId });
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
		// Focus moves to a neighbouring row (or the heading) once the dialog closes, since the trigger is removed.
		const index = filteredTasks.findIndex((task) => task.id === taskId);
		const neighbour = filteredTasks[index + 1] ?? filteredTasks[index - 1];
		setFocusAfterRemove({ removedId: taskId, targetId: neighbour?.id ?? FOCUS_HEADING });
		deleteMutation.mutate({ householdId, id: taskId });
	};

	const isPending = updateMutation.isPending || deleteMutation.isPending;
	const savingTaskId = updateMutation.isPending ? updateMutation.variables?.id : undefined;

	// Row controls are disabled while the removal is pending, so focus waits for it to settle.
	useEffect(() => {
		if (!focusAfterRemove || isPending || tasks.some((task) => task.id === focusAfterRemove.removedId)) {
			return;
		}
		const { targetId } = focusAfterRemove;
		requestAnimationFrame(() => {
			if (targetId === FOCUS_HEADING) {
				(showAllRef.current ?? headingRef.current)?.focus();
			} else {
				focusTaskRow(targetId);
			}
			setFocusAfterRemove(null);
		});
	}, [focusAfterRemove, isPending, tasks]);

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
			? "animate-row-highlight motion-reduce:animate-none motion-reduce:bg-emerald-500/10 motion-reduce:shadow-[inset_3px_0_0_oklch(69.6%_0.17_162.48)]"
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
			value={task.cadenceTarget || ""}
			onChange={(event) =>
				// Empty while retyping; clamped on blur and save.
				updateTask(task.id, { cadenceTarget: Number.parseInt(event.target.value, 10) || 0 })
			}
			onBlur={() => updateTask(task.id, { cadenceTarget: Math.max(1, task.cadenceTarget || 1) })}
			disabled={isPending}
		/>
	);

	const showsSave = (task: AssignedTaskRow) =>
		isDirty(task) || savingTaskId === task.id || savedConfirmation?.id === task.id;

	// aria-disabled rather than disabled while saving and confirming, so the button keeps keyboard focus.
	const renderSave = (task: AssignedTaskRow, className?: string) => {
		const dirty = isDirty(task);
		const saving = savingTaskId === task.id;
		const confirming = !dirty && !saving && savedConfirmation?.id === task.id;
		const inactive = saving || confirming;
		return (
			<Button
				type="button"
				size="sm"
				variant={confirming ? "ghost" : "default"}
				data-save-for={task.id}
				disabled={isPending && !saving}
				aria-disabled={inactive || undefined}
				onClick={() => {
					if (dirty && !inactive) {
						handleSave(task.id);
					}
				}}
				aria-label={
					confirming ? t("{{task}} saved", { task: task.presetLabel }) : t("Save {{task}}", { task: task.presetLabel })
				}
				className={cn("h-9", !showsSave(task) && "invisible", className)}
			>
				{saving ? (
					<Loader2Icon className="h-4 w-4 animate-spin" />
				) : confirming ? (
					<>
						<CheckIcon className="mr-1 h-4 w-4" aria-hidden="true" />
						{t("Saved")}
					</>
				) : (
					t("Save")
				)}
			</Button>
		);
	};

	const renderRemove = (task: AssignedTaskRow) => (
		<AlertDialog>
			<AlertDialogTrigger asChild>
				<Button
					type="button"
					size="icon"
					variant="ghost"
					disabled={isPending}
					aria-label={t("Remove {{task}}", { task: task.presetLabel })}
					className="h-9 w-9 shrink-0 text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
				>
					<Trash2Icon className="h-4 w-4" />
				</Button>
			</AlertDialogTrigger>
			<AlertDialogContent
				onCloseAutoFocus={(event) => {
					if (focusAfterRemove?.removedId === task.id) {
						event.preventDefault();
					}
				}}
			>
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
	);

	return (
		<Card>
			<CardHeader className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
				<div className="space-y-1">
					<CardTitle ref={headingRef} tabIndex={-1} className="text-xl focus:outline-none">
						{t("All tasks")}
					</CardTitle>
					<CardDescription>{t("Change who does a task and how often, then save the row.")}</CardDescription>
				</div>
				{sortedTasks.length > 0 ? (
					<div className="sm:min-w-[220px]">
						<Select
							value={assigneeFilter}
							onValueChange={(value) => {
								setAssigneeFilter(value);
								setStickyRowIds(new Set());
							}}
							disabled={isPending}
						>
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
				<p role="status" aria-live="polite" className="sr-only">
					<span key={announcement.count}>{announcement.text}</span>
				</p>
				{sortedTasks.length === 0 ? (
					<p className="text-sm text-muted-foreground">{t("No tasks yet.")}</p>
				) : filteredTasks.length === 0 ? (
					<div className="flex flex-col items-start gap-3 py-4 sm:flex-row sm:items-center">
						<p className="text-sm text-muted-foreground">{t("No tasks match this filter.")}</p>
						<Button
							ref={showAllRef}
							type="button"
							variant="outline"
							size="sm"
							onClick={() => {
								setAssigneeFilter(ASSIGNEE_ALL_VALUE);
								const firstId = sortedTasks[0]?.id;
								if (firstId) {
									requestAnimationFrame(() => focusTaskRow(firstId));
								}
							}}
						>
							{t("Show all assignees")}
						</Button>
					</div>
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
										<TableHead className="w-32 text-right">
											<span className="sr-only">{t("Actions")}</span>
										</TableHead>
									</TableRow>
								</TableHeader>
								{/* Solid control backgrounds so row hover and highlight tints don't wash them out. */}
								<TableBody className="[&_button[role=combobox]]:bg-card [&_input]:bg-card">
									{filteredTasks.map((task) => (
										<TableRow key={task.id} data-task-id={task.id} className={highlightClass(task)}>
											<TableCell>
												<span className="font-semibold">{task.presetLabel}</span>
												{matchesFilter(task) ? null : (
													<span className="block text-xs text-muted-foreground">{t("Not in this filter")}</span>
												)}
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
											<TableCell>
												<div className="flex items-center justify-end gap-1">
													{renderSave(task, "w-20")}
													{renderRemove(task)}
												</div>
											</TableCell>
										</TableRow>
									))}
								</TableBody>
							</Table>
						</div>
						<ul className="divide-y md:hidden">
							{filteredTasks.map((task) => (
								<li
									key={task.id}
									data-task-id={task.id}
									className={cn(
										// Every item shares the same inset, so the highlight never changes an item's bounds.
										"-mx-3 grid gap-3 px-3 py-4 [&_button[role=combobox]]:bg-card [&_input]:bg-card",
										highlightClass(task),
									)}
								>
									<div className="flex items-start justify-between gap-3">
										<div className="min-w-0">
											<p className="font-semibold">{task.presetLabel}</p>
											{matchesFilter(task) ? null : (
												<p className="text-xs text-muted-foreground">{t("Not in this filter")}</p>
											)}
											<p className="text-sm text-muted-foreground">{formatProgress(task)}</p>
										</div>
										<div className="-mr-2">{renderRemove(task)}</div>
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
									{/* After the fields, so tabbing from the last edited field reaches Save. */}
									{showsSave(task) ? renderSave(task, "w-full") : null}
								</li>
							))}
						</ul>
					</>
				)}
			</CardContent>
		</Card>
	);
};
