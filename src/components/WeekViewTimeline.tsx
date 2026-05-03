"use client";

import { CalendarClockIcon, CheckCircle2Icon, CheckIcon, Clock3Icon, type LucideIcon } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";

import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/Card";
import { useToast } from "@/hooks/useToast";
import { type DateFormat, formatDate, formatTime, type TimeFormat } from "@/lib/formatDate";
import { useTranslation } from "@/lib/i18nClient";
import { DURATION_BUCKETS } from "@/lib/points";
import { trpc } from "@/lib/trpc/react";
import { cn } from "@/lib/utils";
import type { WeekViewTimelineEntry } from "@/lib/week-view/buildTimeline";

type Labels = {
	title: string;
	description: string;
	emptyTitle: string;
	emptyDescription: string;
	completed: string;
	pendingApproval: string;
	planned: string;
	oneOff: string;
};

type Props = {
	dateFormat: DateFormat;
	entries: WeekViewTimelineEntry[];
	householdId: string;
	labels: Labels;
	timeFormat: TimeFormat;
	timeZone: string;
	canCompletePlannedEntries?: boolean;
};

const bucketLabelMap = Object.fromEntries(DURATION_BUCKETS.map((bucket) => [bucket.key, bucket.label]));

type EntryAppearance = {
	toneClass: string;
	iconClass: string;
	badgeClass: string;
	icon: LucideIcon;
	statusLabel: string;
};

const getEntryAppearance = (entry: WeekViewTimelineEntry, labels: Labels): EntryAppearance => {
	if (entry.type === "planned") {
		return {
			toneClass: "border-sky-500/20 bg-sky-500/5",
			iconClass: "bg-sky-500/15 text-sky-700 dark:text-sky-300",
			badgeClass: "bg-sky-500/15 text-sky-700 dark:text-sky-200",
			icon: CalendarClockIcon,
			statusLabel: labels.planned,
		};
	}
	if (entry.status === "PENDING") {
		return {
			toneClass: "border-amber-500/20 bg-amber-500/5",
			iconClass: "bg-amber-500/15 text-amber-700 dark:text-amber-300",
			badgeClass: "bg-amber-500/15 text-amber-700 dark:text-amber-200",
			icon: Clock3Icon,
			statusLabel: labels.pendingApproval,
		};
	}
	return {
		toneClass: "border-emerald-500/20 bg-emerald-500/5",
		iconClass: "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300",
		badgeClass: "bg-emerald-500/15 text-emerald-700 dark:text-emerald-200",
		icon: CheckCircle2Icon,
		statusLabel: labels.completed,
	};
};

const groupEntriesByDay = (
	entries: WeekViewTimelineEntry[],
	{ dateFormat, timeZone }: { dateFormat: DateFormat; timeZone: string },
) =>
	entries.reduce<Map<string, WeekViewTimelineEntry[]>>((map, entry) => {
		const key = formatDate(entry.occurredAt, { timeZone, dateFormat });
		const current = map.get(key) ?? [];
		current.push(entry);
		map.set(key, current);
		return map;
	}, new Map());

const formatCadenceLabel = (
	entry: Extract<WeekViewTimelineEntry, { type: "planned" }>,
	t: ReturnType<typeof useTranslation>["t"],
	labels: Labels,
) => {
	if (!entry.isRecurring || entry.cadenceIntervalMinutes === null) {
		return labels.oneOff;
	}

	switch (entry.cadenceIntervalMinutes) {
		case 1440:
			return t("Daily");
		case 10080:
			return t("Weekly");
		case 20160:
			return t("Fortnightly");
		case 43200:
			return t("Monthly");
		case 129600:
			return t("Quarterly");
		case 525600:
			return t("Yearly");
		default:
			if (entry.cadenceIntervalMinutes % 60 === 0) {
				return t("Every {{count}}h", { count: Math.round(entry.cadenceIntervalMinutes / 60) });
			}

			return t("Every {{count}}m", { count: entry.cadenceIntervalMinutes });
	}
};

export const WeekViewTimeline = ({
	dateFormat,
	entries,
	householdId,
	labels,
	timeFormat,
	timeZone,
	canCompletePlannedEntries = false,
}: Props) => {
	const router = useRouter();
	const { toast } = useToast();
	const { t } = useTranslation();
	const [completingAssignedTaskId, setCompletingAssignedTaskId] = useState<string | null>(null);
	const completeMutation = trpc.assignedTasks.complete.useMutation({
		onSuccess: (result) => {
			const isPendingApproval = result.entry.status === "PENDING";
			toast({
				title: isPendingApproval ? t("Submitted for approval") : t("Task completed"),
				description: isPendingApproval
					? t("Completion logged and waiting for approval.")
					: t("Completion logged and points added."),
			});
			setCompletingAssignedTaskId(null);
			router.refresh();
		},
		onError: (error) => {
			setCompletingAssignedTaskId(null);
			toast({
				title: t("Unable to complete task"),
				description: error.message ?? t("Please try again."),
				variant: "destructive",
			});
		},
	});
	const groups = groupEntriesByDay(entries, { dateFormat, timeZone });
	const handleComplete = (assignedTaskId: string) => {
		setCompletingAssignedTaskId(assignedTaskId);
		completeMutation.mutate({ householdId, id: assignedTaskId });
	};

	return (
		<Card>
			<CardHeader>
				<CardTitle className="text-xl">{labels.title}</CardTitle>
				<CardDescription>{labels.description}</CardDescription>
			</CardHeader>
			<CardContent>
				{entries.length === 0 ? (
					<EmptyState title={labels.emptyTitle} description={labels.emptyDescription} />
				) : (
					<div className="space-y-6">
						{Array.from(groups.entries()).map(([dayLabel, dayEntries]) => (
							<DayGroup
								key={dayLabel}
								dayLabel={dayLabel}
								entries={dayEntries}
								canCompletePlannedEntries={canCompletePlannedEntries}
								completingAssignedTaskId={completingAssignedTaskId}
								onComplete={handleComplete}
								labels={labels}
								timeFormat={timeFormat}
								timeZone={timeZone}
							/>
						))}
					</div>
				)}
			</CardContent>
		</Card>
	);
};

const EmptyState = ({ title, description }: { title: string; description: string }) => (
	<div className="rounded-xl border border-dashed p-6 text-center">
		<p className="font-medium">{title}</p>
		<p className="mt-1 text-sm text-muted-foreground">{description}</p>
	</div>
);

type DayGroupProps = {
	canCompletePlannedEntries: boolean;
	completingAssignedTaskId: string | null;
	dayLabel: string;
	entries: WeekViewTimelineEntry[];
	labels: Labels;
	onComplete: (assignedTaskId: string) => void;
	timeFormat: TimeFormat;
	timeZone: string;
};

const DayGroup = ({
	canCompletePlannedEntries,
	completingAssignedTaskId,
	dayLabel,
	entries,
	labels,
	onComplete,
	timeFormat,
	timeZone,
}: DayGroupProps) => (
	<section className="space-y-3">
		<div className="flex items-center gap-3">
			<h2 className="text-sm font-semibold uppercase tracking-[0.2em] text-muted-foreground">{dayLabel}</h2>
			<div className="h-px flex-1 bg-border" />
		</div>
		<ol className="space-y-3">
			{entries.map((entry) => (
				<li key={entry.id}>
					<TimelineEntry
						entry={entry}
						canComplete={canCompletePlannedEntries && entry.type === "planned"}
						completingAssignedTaskId={completingAssignedTaskId}
						labels={labels}
						onComplete={onComplete}
						timeFormat={timeFormat}
						timeZone={timeZone}
					/>
				</li>
			))}
		</ol>
	</section>
);

type TimelineEntryProps = {
	canComplete: boolean;
	completingAssignedTaskId: string | null;
	entry: WeekViewTimelineEntry;
	labels: Labels;
	onComplete: (assignedTaskId: string) => void;
	timeFormat: TimeFormat;
	timeZone: string;
};

const TimelineEntry = ({
	canComplete,
	completingAssignedTaskId,
	entry,
	labels,
	onComplete,
	timeFormat,
	timeZone,
}: TimelineEntryProps) => {
	const { t } = useTranslation();
	const appearance = getEntryAppearance(entry, labels);
	const Icon = appearance.icon;
	const showTime = !(entry.type === "planned" && entry.isRecurring);
	const timeLabel = showTime ? formatTime(entry.occurredAt, timeFormat, timeZone) : null;
	const bucketLabel = entry.bucket ? (bucketLabelMap[entry.bucket] ?? entry.bucket) : null;
	const cadenceLabel = entry.type === "planned" ? formatCadenceLabel(entry, t, labels) : null;
	const assignedTaskId = entry.type === "planned" ? entry.assignedTaskId : null;
	const metaItems = [
		{ key: "time", value: timeLabel },
		{ key: "bucket", value: bucketLabel },
		{ key: "cadence", value: cadenceLabel },
	].filter((item): item is { key: string; value: string } => Boolean(item.value));

	const showCompleteButton = canComplete && assignedTaskId !== null;
	const isCompleting = assignedTaskId !== null && completingAssignedTaskId === assignedTaskId;
	const isAnyCompletionPending = completingAssignedTaskId !== null;

	return (
		<div className={cn("rounded-2xl border p-4 shadow-sm", appearance.toneClass)}>
			<div className="flex items-center gap-3">
				<div className={cn("shrink-0 rounded-full p-2", appearance.iconClass)}>
					<Icon className="h-4 w-4" />
				</div>
				<div className="min-w-0 flex-1 space-y-1.5">
					<p className="truncate text-base font-semibold leading-tight">{entry.description}</p>
					<div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-sm text-muted-foreground">
						<Badge variant="secondary" className={cn("font-medium", appearance.badgeClass)}>
							{appearance.statusLabel}
						</Badge>
						{metaItems.map((item, index) => (
							<span key={`${entry.id}-${item.key}`} className="flex items-center gap-2">
								{index === 0 ? null : <span aria-hidden className="size-1 rounded-full bg-muted-foreground/40" />}
								<span>{item.value}</span>
							</span>
						))}
					</div>
				</div>
				<div className="flex shrink-0 items-center gap-2">
					{showCompleteButton && assignedTaskId ? (
						<Button
							type="button"
							size="sm"
							disabled={isAnyCompletionPending}
							onClick={() => onComplete(assignedTaskId)}
						>
							<CheckIcon aria-hidden className="h-4 w-4" />
							<span>{isCompleting ? t("Completing...") : t("Complete")}</span>
						</Button>
					) : null}
					<Badge variant="outline" className="bg-background/80">
						{entry.points.toLocaleString()} pts
					</Badge>
				</div>
			</div>
		</div>
	);
};
