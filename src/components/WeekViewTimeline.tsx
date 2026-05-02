import { CalendarClockIcon, CheckCircle2Icon, Clock3Icon, type LucideIcon } from "lucide-react";

import { Badge } from "@/components/ui/Badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/Card";
import { type DateFormat, formatDate, formatTime, type TimeFormat } from "@/lib/formatDate";
import { DURATION_BUCKETS } from "@/lib/points";
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
	labels: Labels;
	timeFormat: TimeFormat;
	timeZone: string;
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
			iconClass: "bg-sky-500/12 text-sky-700",
			badgeClass: "bg-sky-500/12 text-sky-800",
			icon: CalendarClockIcon,
			statusLabel: labels.planned,
		};
	}
	if (entry.status === "PENDING") {
		return {
			toneClass: "border-amber-500/20 bg-amber-500/5",
			iconClass: "bg-amber-500/12 text-amber-700",
			badgeClass: "bg-amber-500/12 text-amber-800",
			icon: Clock3Icon,
			statusLabel: labels.pendingApproval,
		};
	}
	return {
		toneClass: "border-emerald-500/20 bg-emerald-500/5",
		iconClass: "bg-emerald-500/12 text-emerald-700",
		badgeClass: "bg-emerald-500/12 text-emerald-800",
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

export const WeekViewTimeline = ({ dateFormat, entries, labels, timeFormat, timeZone }: Props) => {
	const groups = groupEntriesByDay(entries, { dateFormat, timeZone });

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
	dayLabel: string;
	entries: WeekViewTimelineEntry[];
	labels: Labels;
	timeFormat: TimeFormat;
	timeZone: string;
};

const DayGroup = ({ dayLabel, entries, labels, timeFormat, timeZone }: DayGroupProps) => (
	<section className="space-y-3">
		<div className="flex items-center gap-3">
			<h2 className="text-sm font-semibold uppercase tracking-[0.2em] text-muted-foreground">{dayLabel}</h2>
			<div className="h-px flex-1 bg-border" />
		</div>
		<ol className="space-y-3">
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
	const appearance = getEntryAppearance(entry, labels);
	const Icon = appearance.icon;
	const timeLabel = formatTime(entry.occurredAt, timeFormat, timeZone);
	const bucketLabel = entry.bucket ? (bucketLabelMap[entry.bucket] ?? entry.bucket) : null;
	const cadenceLabel = entry.type === "planned" ? (entry.isRecurring ? entry.cadenceLabel : labels.oneOff) : null;

	return (
		<div className={cn("rounded-2xl border p-4 shadow-sm", appearance.toneClass)}>
			<div className="flex items-start gap-3">
				<div className={cn("mt-0.5 rounded-full p-2", appearance.iconClass)}>
					<Icon className="h-4 w-4" />
				</div>
				<div className="min-w-0 flex-1 space-y-2">
					<div className="flex flex-wrap items-start justify-between gap-2">
						<div className="min-w-0">
							<p className="text-base font-semibold leading-tight">{entry.description}</p>
							<div className="mt-1 flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
								<span>{timeLabel}</span>
								{bucketLabel ? <span>{bucketLabel}</span> : null}
								{cadenceLabel ? <span>{cadenceLabel}</span> : null}
							</div>
						</div>
						<Badge variant="outline" className="shrink-0 bg-background/80">
							{entry.points.toLocaleString()} pts
						</Badge>
					</div>
					<div className="flex flex-wrap gap-2">
						<Badge variant="secondary" className={appearance.badgeClass}>
							{appearance.statusLabel}
						</Badge>
					</div>
				</div>
			</div>
		</div>
	);
};
