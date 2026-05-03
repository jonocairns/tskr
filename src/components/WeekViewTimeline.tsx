"use client";

import { CalendarClockIcon, CheckCircle2Icon, CheckIcon, Clock3Icon, type LucideIcon } from "lucide-react";
import { useRouter } from "next/navigation";
import { type ReactNode, useState } from "react";

import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Card, CardContent, CardHeader } from "@/components/ui/Card";
import { useToast } from "@/hooks/useToast";
import { formatDate, formatReadableDate, formatTime, type TimeFormat } from "@/lib/formatDate";
import { useTranslation } from "@/lib/i18nClient";
import { DURATION_BUCKETS } from "@/lib/points";
import { getTimeZoneDayNumber } from "@/lib/timeZones";
import { trpc } from "@/lib/trpc/react";
import { cn } from "@/lib/utils";
import type { WeekViewTimelineEntry } from "@/lib/week-view/buildTimeline";

type Labels = {
	emptyTitle: string;
	emptyDescription: string;
	completed: string;
	pendingApproval: string;
	planned: string;
	oneOff: string;
};

type Props = {
	entries: WeekViewTimelineEntry[];
	header?: ReactNode;
	householdId: string;
	labels: Labels;
	timeFormat: TimeFormat;
	timeZone: string;
	canCompletePlannedEntries?: boolean;
};

const bucketLabelMap = Object.fromEntries(DURATION_BUCKETS.map((bucket) => [bucket.key, bucket.label]));

type EntryAppearance = {
	iconClass: string;
	badgeClass: string;
	icon: LucideIcon;
	statusLabel: string;
	showStatusBadge: boolean;
};

const getEntryAppearance = (entry: WeekViewTimelineEntry, labels: Labels): EntryAppearance => {
	if (entry.type === "planned") {
		return {
			iconClass: "bg-sky-500/15 text-sky-700 dark:text-sky-300",
			badgeClass: "bg-sky-500/15 text-sky-700 dark:text-sky-200",
			icon: CalendarClockIcon,
			statusLabel: labels.planned,
			showStatusBadge: true,
		};
	}
	if (entry.status === "PENDING") {
		return {
			iconClass: "bg-amber-500/15 text-amber-700 dark:text-amber-300",
			badgeClass: "bg-amber-500/15 text-amber-700 dark:text-amber-200",
			icon: Clock3Icon,
			statusLabel: labels.pendingApproval,
			showStatusBadge: true,
		};
	}
	return {
		iconClass: "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300",
		badgeClass: "bg-emerald-500/15 text-emerald-700 dark:text-emerald-200",
		icon: CheckCircle2Icon,
		statusLabel: labels.completed,
		showStatusBadge: false,
	};
};

type DayBucket = {
	dayNumber: number;
	occurredAt: string;
	entries: WeekViewTimelineEntry[];
};

const groupEntriesByDay = (entries: WeekViewTimelineEntry[], { timeZone }: { timeZone: string }): DayBucket[] => {
	const buckets = new Map<number, DayBucket>();
	for (const entry of entries) {
		const dayNumber = getTimeZoneDayNumber(new Date(entry.occurredAt), timeZone);
		const existing = buckets.get(dayNumber);
		if (existing) {
			existing.entries.push(entry);
			continue;
		}
		buckets.set(dayNumber, {
			dayNumber,
			occurredAt: entry.occurredAt,
			entries: [entry],
		});
	}
	return Array.from(buckets.values());
};

const formatRelativeDayLabel = ({
	dayNumber,
	dateLabel,
	todayNumber,
	t,
}: {
	dayNumber: number;
	dateLabel: string;
	todayNumber: number;
	t: ReturnType<typeof useTranslation>["t"];
}) => {
	const diff = todayNumber - dayNumber;
	if (diff === 0) return t("Today");
	if (diff === 1) return t("Yesterday");
	if (diff > 1 && diff <= 7) return t("{{count}} days ago", { count: diff });
	if (diff === -1) return t("Tomorrow");
	if (diff < -1 && diff >= -7) return t("In {{count}} days", { count: Math.abs(diff) });
	return dateLabel;
};

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
	entries,
	header,
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
	const groups = groupEntriesByDay(entries, { timeZone });
	const todayNumber = getTimeZoneDayNumber(new Date(), timeZone);
	const currentYear = formatDate(new Date(), { timeZone, dateFormat: "YMD" }).slice(0, 4);
	const handleComplete = (assignedTaskId: string) => {
		setCompletingAssignedTaskId(assignedTaskId);
		completeMutation.mutate({ householdId, id: assignedTaskId });
	};

	return (
		<Card>
			{header ? <CardHeader>{header}</CardHeader> : null}
			<CardContent>
				{entries.length === 0 ? (
					<EmptyState title={labels.emptyTitle} description={labels.emptyDescription} />
				) : (
					<div className="space-y-6">
						{groups.map((group) => {
							const groupYear = formatDate(group.occurredAt, { timeZone, dateFormat: "YMD" }).slice(0, 4);
							const includeYear = groupYear !== currentYear;
							const friendlyDateLabel = formatReadableDate(group.occurredAt, { timeZone, includeYear });
							return (
								<DayGroup
									key={group.dayNumber}
									dayLabel={formatRelativeDayLabel({
										dayNumber: group.dayNumber,
										dateLabel: friendlyDateLabel,
										todayNumber,
										t,
									})}
									entries={group.entries}
									canCompletePlannedEntries={canCompletePlannedEntries}
									completingAssignedTaskId={completingAssignedTaskId}
									onComplete={handleComplete}
									labels={labels}
									timeFormat={timeFormat}
									timeZone={timeZone}
								/>
							);
						})}
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
	<section>
		<h2 className="text-sm font-semibold uppercase tracking-[0.2em] text-muted-foreground">{dayLabel}</h2>
		<ol className="mt-2 divide-y divide-border/50">
			{entries.map((entry) => (
				<li key={entry.id}>
					<TimelineEntry
						entry={entry}
						canComplete={canCompletePlannedEntries && entry.type === "planned" && entry.canComplete}
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
	const pointsLabel = `${entry.points.toLocaleString()} pts`;
	const gutterLabel = timeLabel ?? cadenceLabel ?? "—";
	const mobileMeta = [
		{ key: "time", value: timeLabel },
		{ key: "bucket", value: bucketLabel },
		{ key: "cadence", value: cadenceLabel },
		{ key: "points", value: pointsLabel },
	].filter((item): item is { key: string; value: string } => Boolean(item.value));
	const desktopMeta = [
		// time lives in the gutter, cadence too if there is no time
		{ key: "cadence", value: timeLabel ? cadenceLabel : null },
		{ key: "bucket", value: bucketLabel },
		{ key: "points", value: pointsLabel },
	].filter((item): item is { key: string; value: string } => Boolean(item.value));

	const showCompleteButton = canComplete && assignedTaskId !== null;
	const isCompleting = assignedTaskId !== null && completingAssignedTaskId === assignedTaskId;
	const isAnyCompletionPending = completingAssignedTaskId !== null;

	return (
		<div className="flex flex-wrap items-start gap-x-3 gap-y-2 px-2 py-3 transition-colors hover:bg-accent/40 lg:flex-nowrap lg:items-center lg:gap-4">
			<span className="hidden w-16 shrink-0 text-sm tabular-nums text-muted-foreground lg:block">{gutterLabel}</span>
			<div className={cn("shrink-0 rounded-full p-2", appearance.iconClass)}>
				<Icon className="h-4 w-4" />
			</div>
			<div className="min-w-0 flex-1 space-y-1.5 lg:flex lg:flex-none lg:items-center lg:gap-3 lg:space-y-0">
				<p className="truncate text-base font-semibold leading-tight lg:max-w-md">{entry.description}</p>
				<div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-muted-foreground lg:hidden">
					{appearance.showStatusBadge ? (
						<Badge variant="secondary" className={cn("font-medium", appearance.badgeClass)}>
							{appearance.statusLabel}
						</Badge>
					) : null}
					{mobileMeta.map((item) => (
						<span key={`${entry.id}-mobile-${item.key}`}>{item.value}</span>
					))}
				</div>
				<div className="hidden shrink-0 items-center gap-2 text-sm text-muted-foreground lg:flex">
					{appearance.showStatusBadge ? (
						<Badge variant="secondary" className={cn("font-medium", appearance.badgeClass)}>
							{appearance.statusLabel}
						</Badge>
					) : null}
					{desktopMeta.map((item, index) => (
						<span key={`${entry.id}-desktop-${item.key}`} className="flex items-center gap-2">
							{index === 0 && !appearance.showStatusBadge ? null : (
								<span aria-hidden className="size-1 rounded-full bg-muted-foreground/40" />
							)}
							<span>{item.value}</span>
						</span>
					))}
				</div>
			</div>
			{showCompleteButton && assignedTaskId ? (
				<Button
					type="button"
					size="sm"
					className="ml-[2.75rem] h-7 self-start px-2.5 text-xs lg:ml-auto"
					disabled={isAnyCompletionPending}
					onClick={() => onComplete(assignedTaskId)}
				>
					<CheckIcon aria-hidden className="h-4 w-4" />
					<span>{isCompleting ? t("Completing...") : t("Complete")}</span>
				</Button>
			) : null}
		</div>
	);
};
