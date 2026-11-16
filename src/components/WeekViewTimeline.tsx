"use client";

import { CheckCircle2Icon, Clock3Icon } from "lucide-react";
import type { ReactNode } from "react";

import { Badge } from "@/components/ui/Badge";
import { Card, CardContent, CardHeader } from "@/components/ui/Card";
import { getBucketLabels } from "@/lib/assignedTasksCadence";
import { formatDate, formatReadableDate, formatTime, type TimeFormat } from "@/lib/formatDate";
import { useTranslation } from "@/lib/i18nClient";
import { getTimeZoneDayNumber } from "@/lib/timeZones";
import { cn } from "@/lib/utils";
import type { WeekViewTimelineEntry } from "@/lib/week-view/buildTimeline";

type Labels = {
	emptyTitle: string;
	emptyDescription: string;
	completed: string;
	pendingApproval: string;
	quickLog: string;
};

type Props = {
	entries: WeekViewTimelineEntry[];
	header?: ReactNode;
	labels: Labels;
	timeFormat: TimeFormat;
	timeZone: string;
};

const getEntryAppearance = (entry: WeekViewTimelineEntry, labels: Labels) => {
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

const groupEntriesByDay = (entries: WeekViewTimelineEntry[], { timeZone }: { timeZone: string }) => {
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

export const WeekViewTimeline = ({ entries, header, labels, timeFormat, timeZone }: Props) => {
	const { t } = useTranslation();
	const groups = groupEntriesByDay(entries, { timeZone });
	const todayNumber = getTimeZoneDayNumber(new Date(), timeZone);
	const currentYear = formatDate(new Date(), { timeZone, dateFormat: "YMD" }).slice(0, 4);

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
	dayLabel: string;
	entries: WeekViewTimelineEntry[];
	labels: Labels;
	timeFormat: TimeFormat;
	timeZone: string;
};

const DayGroup = ({ dayLabel, entries, labels, timeFormat, timeZone }: DayGroupProps) => (
	<section>
		<h2 className="text-sm font-semibold uppercase tracking-[0.2em] text-muted-foreground">{dayLabel}</h2>
		<ol className="mt-2 divide-y divide-border/50">
			{entries.map((entry) => (
				<li key={entry.id}>
					<TimelineEntry entry={entry} labels={labels} timeFormat={timeFormat} timeZone={timeZone} />
				</li>
			))}
		</ol>
	</section>
);

type TimelineEntryProps = {
	entry: WeekViewTimelineEntry;
	labels: Labels;
	timeFormat: TimeFormat;
	timeZone: string;
};

const TimelineEntry = ({ entry, labels, timeFormat, timeZone }: TimelineEntryProps) => {
	const { t } = useTranslation();
	const appearance = getEntryAppearance(entry, labels);
	const Icon = appearance.icon;
	const timeLabel = formatTime(entry.occurredAt, timeFormat, timeZone);
	const bucketLabel = entry.bucket ? getBucketLabels(t)[entry.bucket] : null;
	const pointsLabel = t("{{count}} pts", { count: entry.points });
	const assigneeLabel = entry.assignedTo
		? t("Assigned to {{name}}", { name: entry.assignedTo.name ?? entry.assignedTo.email ?? t("Unknown") })
		: entry.assignedTaskId
			? t("Open")
			: null;
	const completerLabel = t("Completed by {{name}}", {
		name: entry.completedBy.name ?? entry.completedBy.email ?? t("Unknown"),
	});
	const gutterLabel = timeLabel;
	const mobileMeta = [
		{ key: "time", value: timeLabel },
		{ key: "bucket", value: bucketLabel },
		{ key: "points", value: pointsLabel },
		{ key: "assignee", value: assigneeLabel },
		{ key: "completer", value: completerLabel },
	].filter((item): item is { key: string; value: string } => Boolean(item.value));
	const desktopMeta = [
		{ key: "bucket", value: bucketLabel },
		{ key: "points", value: pointsLabel },
		{ key: "assignee", value: assigneeLabel },
		{ key: "completer", value: completerLabel },
	].filter((item): item is { key: string; value: string } => Boolean(item.value));

	return (
		<div className="flex flex-wrap items-start gap-x-3 gap-y-2 px-2 py-3 transition-colors hover:bg-accent/40 lg:flex-nowrap lg:items-center lg:gap-4">
			<span className="hidden w-16 shrink-0 text-sm tabular-nums text-muted-foreground lg:block">{gutterLabel}</span>
			<div className={cn("shrink-0 rounded-full p-2", appearance.iconClass)}>
				<Icon className="h-4 w-4" />
			</div>
			<div className="min-w-0 flex-1 space-y-1.5 lg:flex lg:flex-1 lg:flex-wrap lg:items-center lg:gap-3 lg:space-y-0">
				<p className="truncate text-base font-semibold leading-tight lg:max-w-md">{entry.description}</p>
				{entry.assignedTaskId === null ? <Badge variant="secondary">{labels.quickLog}</Badge> : null}
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
				<div className="hidden flex-wrap items-center gap-2 text-sm text-muted-foreground lg:flex">
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
		</div>
	);
};
