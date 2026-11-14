"use client";

import { CheckIcon } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";

import {
	AlertDialog,
	AlertDialogAction,
	AlertDialogCancel,
	AlertDialogContent,
	AlertDialogDescription,
	AlertDialogFooter,
	AlertDialogHeader,
	AlertDialogTitle,
} from "@/components/ui/AlertDialog";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/Card";
import { Progress } from "@/components/ui/Progress";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/Table";
import { useToast } from "@/hooks/useToast";
import { formatCadenceInterval, getBucketLabels } from "@/lib/assignedTasksCadence";
import { type DateFormat, formatDateTime, type TimeFormat } from "@/lib/formatDate";
import { useTranslation } from "@/lib/i18nClient";
import type { DurationKey } from "@/lib/points";
import { trpc } from "@/lib/trpc/react";

export type AssignedTaskEntry = {
	id: string;
	group: "mine" | "open" | "others";
	assigneeLabel: string | null;
	state: "available" | "awaitingApproval";
	pendingCompleters: Array<string | null>;
	presetId: string;
	label: string;
	bucket: DurationKey;
	points: number;
	assignedAt: string;
	cadenceTarget: number;
	cadenceIntervalMinutes: number;
	isRecurring: boolean;
	progress: number;
	completedLastCycle: boolean;
	lastCompletedAt: string | null;
	nextResetAt: string | null;
};

type Props = {
	householdId: string;
	entries: AssignedTaskEntry[];
	doneThisWeek: number;
	timeZone: string;
	dateFormat: DateFormat;
	timeFormat: TimeFormat;
};

export const AssignedTaskQueue = ({ householdId, entries, doneThisWeek, timeZone, dateFormat, timeFormat }: Props) => {
	const router = useRouter();
	const { toast } = useToast();
	const { t } = useTranslation();
	// Keep the last entry rendered while the dialog animates closed.
	const [confirmEntry, setConfirmEntry] = useState<AssignedTaskEntry | null>(null);
	const [confirmOpen, setConfirmOpen] = useState(false);
	const bucketLabels = getBucketLabels(t);
	const [isMobile, setIsMobile] = useState(false);

	useEffect(() => {
		const checkMobile = () => setIsMobile(window.innerWidth < 640);
		checkMobile();
		window.addEventListener("resize", checkMobile);
		return () => window.removeEventListener("resize", checkMobile);
	}, []);

	const completeMutation = trpc.assignedTasks.complete.useMutation({
		onSuccess: (result) => {
			const isPendingApproval = result.entry.status === "PENDING";
			toast({
				title: isPendingApproval ? t("Submitted for approval") : t("Task completed"),
				description: isPendingApproval
					? t("Completion logged and waiting on approval.")
					: t("Completion logged and points added."),
			});
			router.refresh();
		},
		onError: (error) => {
			toast({
				title: t("Unable to complete task"),
				description: error.message ?? t("Please try again."),
				variant: "destructive",
			});
			if (error.data?.code === "BAD_REQUEST") router.refresh();
		},
	});

	const handleComplete = (taskId: string) => {
		completeMutation.mutate({ householdId, id: taskId });
	};

	const isPending = completeMutation.isPending;

	const renderEntries = (groupEntries: AssignedTaskEntry[]) => (
		<Table>
			<TableHeader>
				<TableRow>
					<TableHead>{t("Task")}</TableHead>
					<TableHead className="text-right sm:hidden">{t("Progress")}</TableHead>
					<TableHead className="hidden sm:table-cell">{t("Progress")}</TableHead>
					<TableHead className="hidden sm:table-cell">{t("Cadence")}</TableHead>
					<TableHead className="text-right">{t("Actions")}</TableHead>
				</TableRow>
			</TableHeader>
			<TableBody>
				{groupEntries.map((entry) => {
					const target = Math.max(entry.cadenceTarget, 1);
					const progressValue = Math.min(100, Math.round((entry.progress / target) * 100));
					const bgStyle = {
						backgroundImage: `linear-gradient(to right, rgb(255 255 255 / 0.05) ${progressValue}%, transparent ${progressValue}%)`,
					};
					return (
						<TableRow key={entry.id} style={isMobile ? bgStyle : undefined}>
							<TableCell>
								<div className="flex flex-col gap-1">
									<span className="font-semibold">{entry.label}</span>
									{entry.group === "others" ? (
										<span className="text-xs text-muted-foreground">
											{t("Assigned to {{name}}", { name: entry.assigneeLabel ?? t("Unknown") })}
										</span>
									) : null}
									{entry.state === "awaitingApproval" ? (
										<span className="text-sm text-muted-foreground">
											{t("Awaiting approval, done by {{names}}", {
												names: entry.pendingCompleters.map((name) => name ?? t("Someone")).join(", "),
											})}
										</span>
									) : null}
									{entry.completedLastCycle ? (
										<Badge variant="secondary" className="w-fit">
											{t("Completed last cycle")}
										</Badge>
									) : null}
									<span className="text-xs text-muted-foreground">
										{t("{{count}} pts", { count: entry.points })} - {bucketLabels[entry.bucket]}
									</span>
									{entry.lastCompletedAt ? (
										<span className="text-xs text-muted-foreground">
											{t("Last completed {{date}}", {
												date: formatDateTime(entry.lastCompletedAt, { timeZone, dateFormat, timeFormat }),
											})}
										</span>
									) : null}
									{entry.nextResetAt ? (
										<span className="text-xs text-muted-foreground">
											{t("Resets {{date}}", {
												date: formatDateTime(entry.nextResetAt, { timeZone, dateFormat, timeFormat }),
											})}
										</span>
									) : null}
								</div>
							</TableCell>
							<TableCell className="text-right text-sm text-muted-foreground sm:hidden">
								{entry.progress}/{entry.cadenceTarget}
							</TableCell>
							<TableCell className="hidden sm:table-cell">
								<div className="space-y-2">
									<div className="flex items-center justify-between text-xs text-muted-foreground">
										<span>
											{entry.progress}/{entry.cadenceTarget}
										</span>
										<span>{progressValue}%</span>
									</div>
									<Progress value={progressValue} />
								</div>
							</TableCell>
							<TableCell className="hidden sm:table-cell">
								<div className="flex items-center gap-2 text-sm">
									<Badge variant="secondary">{entry.isRecurring ? t("Recurring") : t("One-off")}</Badge>
									<span className="text-muted-foreground">
										{entry.isRecurring ? formatCadenceInterval(entry.cadenceIntervalMinutes, t) : t("None")}
									</span>
								</div>
							</TableCell>
							<TableCell className="text-right">
								{entry.state === "available" ? (
									<Button
										type="button"
										size="sm"
										disabled={isPending}
										aria-label={t("Complete {{task}}", { task: entry.label })}
										onClick={() => {
											if (entry.group === "others") {
												setConfirmEntry(entry);
												setConfirmOpen(true);
											} else {
												handleComplete(entry.id);
											}
										}}
									>
										<CheckIcon className="h-4 w-4 sm:mr-2" />
										<span className="hidden sm:inline">{t("Complete")}</span>
									</Button>
								) : null}
							</TableCell>
						</TableRow>
					);
				})}
			</TableBody>
		</Table>
	);
	const groups = [
		{ key: "mine", label: t("Yours") },
		{ key: "open", label: t("Open") },
		{ key: "others", label: t("Everyone else's") },
	];

	return (
		<Card>
			<CardHeader>
				<CardTitle className="text-xl">{t("Household tasks")}</CardTitle>
				<CardDescription>{t("Anyone in the household can complete these tasks.")}</CardDescription>
			</CardHeader>
			<CardContent className="space-y-4">
				{entries.length === 0 ? (
					<p className="text-sm text-muted-foreground">{t("No tasks to do right now.")}</p>
				) : (
					groups.map((group) => {
						const groupEntries = entries.filter((entry) => entry.group === group.key);
						if (groupEntries.length === 0) return null;
						return group.key === "others" && groupEntries.length > 5 ? (
							<details key={group.key} className="space-y-2">
								<summary className="cursor-pointer font-semibold">{group.label}</summary>
								<div className="overflow-x-auto">{renderEntries(groupEntries)}</div>
							</details>
						) : (
							<section key={group.key} className="space-y-2">
								<h3 className="font-semibold">{group.label}</h3>
								<div className="overflow-x-auto">{renderEntries(groupEntries)}</div>
							</section>
						);
					})
				)}
				{doneThisWeek > 0 ? (
					<Link
						className="inline-block text-sm font-medium underline underline-offset-4"
						href={`/${householdId}/week?preset=calendarWeek&userId=all`}
					>
						{t("{{count}} done this week →", { count: doneThisWeek })}
					</Link>
				) : null}
			</CardContent>
			<AlertDialog open={confirmOpen} onOpenChange={setConfirmOpen}>
				<AlertDialogContent>
					<AlertDialogHeader>
						<AlertDialogTitle>{t("Complete someone else's task?")}</AlertDialogTitle>
						<AlertDialogDescription>
							{t("Complete {{task}}, assigned to {{name}}? You will receive the points.", {
								task: confirmEntry?.label,
								name: confirmEntry?.assigneeLabel ?? t("Unknown"),
							})}
						</AlertDialogDescription>
					</AlertDialogHeader>
					<AlertDialogFooter>
						<AlertDialogCancel>{t("Cancel")}</AlertDialogCancel>
						<AlertDialogAction
							disabled={isPending}
							onClick={() => {
								if (confirmEntry) handleComplete(confirmEntry.id);
							}}
						>
							{t("Complete")}
						</AlertDialogAction>
					</AlertDialogFooter>
				</AlertDialogContent>
			</AlertDialog>
		</Card>
	);
};
