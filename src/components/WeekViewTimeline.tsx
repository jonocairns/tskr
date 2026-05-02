import { CalendarClockIcon, CheckCircle2Icon, Clock3Icon } from "lucide-react";

import { Badge } from "@/components/ui/Badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/Card";
import { type DateFormat, formatDate, formatTime, type TimeFormat } from "@/lib/formatDate";
import { DURATION_BUCKETS } from "@/lib/points";
import { cn } from "@/lib/utils";
import type { WeekViewTimelineEntry } from "@/lib/week-view/buildTimeline";

type Props = {
	dateFormat: DateFormat;
	entries: WeekViewTimelineEntry[];
	labels: {
		title: string;
		description: string;
		emptyTitle: string;
		emptyDescription: string;
		completed: string;
		pendingApproval: string;
		planned: string;
		oneOff: string;
	};
	timeFormat: TimeFormat;
	timeZone: string;
};

const bucketLabelMap = Object.fromEntries(DURATION_BUCKETS.map((bucket) => [bucket.key, bucket.label]));

export const WeekViewTimeline = ({ dateFormat, entries, labels, timeFormat, timeZone }: Props) => {
	const groups = entries.reduce<Map<string, WeekViewTimelineEntry[]>>((map, entry) => {
		const key = formatDate(entry.occurredAt, { timeZone, dateFormat });
		const current = map.get(key) ?? [];
		current.push(entry);
		map.set(key, current);
		return map;
	}, new Map());

	return (
		<Card>
			<CardHeader>
				<CardTitle className="text-xl">{labels.title}</CardTitle>
				<CardDescription>{labels.description}</CardDescription>
			</CardHeader>
			<CardContent>
				{entries.length === 0 ? (
					<div className="rounded-xl border border-dashed p-6 text-center">
						<p className="font-medium">{labels.emptyTitle}</p>
						<p className="mt-1 text-sm text-muted-foreground">{labels.emptyDescription}</p>
					</div>
				) : (
					<div className="space-y-6">
						{Array.from(groups.entries()).map(([dayLabel, dayEntries]) => (
							<section key={dayLabel} className="space-y-3">
								<div className="flex items-center gap-3">
									<h2 className="text-sm font-semibold uppercase tracking-[0.2em] text-muted-foreground">{dayLabel}</h2>
									<div className="h-px flex-1 bg-border" />
								</div>
								<ol className="space-y-3">
									{dayEntries.map((entry) => (
										<li key={entry.id}>
											<TimelineEntry
												dateFormat={dateFormat}
												entry={entry}
												labels={labels}
												timeFormat={timeFormat}
												timeZone={timeZone}
											/>
										</li>
									))}
								</ol>
							</section>
						))}
					</div>
				)}
			</CardContent>
		</Card>
	);
};

const TimelineEntry = ({
	entry,
	labels,
	timeFormat,
	timeZone,
}: {
	dateFormat: DateFormat;
	entry: WeekViewTimelineEntry;
	labels: Props["labels"];
	timeFormat: TimeFormat;
	timeZone: string;
}) => {
	const toneClass =
		entry.type === "planned"
			? "border-sky-500/20 bg-sky-500/5"
			: entry.status === "PENDING"
				? "border-amber-500/20 bg-amber-500/5"
				: "border-emerald-500/20 bg-emerald-500/5";
	const iconClass =
		entry.type === "planned"
			? "bg-sky-500/12 text-sky-700"
			: entry.status === "PENDING"
				? "bg-amber-500/12 text-amber-700"
				: "bg-emerald-500/12 text-emerald-700";
	const timeLabel = formatTime(entry.occurredAt, timeFormat, timeZone);
	const bucketLabel = entry.bucket ? (bucketLabelMap[entry.bucket] ?? entry.bucket) : null;

	return (
		<div className={cn("rounded-2xl border p-4 shadow-sm", toneClass)}>
			<div className="flex items-start gap-3">
				<div className={cn("mt-0.5 rounded-full p-2", iconClass)}>
					{entry.type === "planned" ? (
						<CalendarClockIcon className="h-4 w-4" />
					) : entry.status === "PENDING" ? (
						<Clock3Icon className="h-4 w-4" />
					) : (
						<CheckCircle2Icon className="h-4 w-4" />
					)}
				</div>
				<div className="min-w-0 flex-1 space-y-2">
					<div className="flex flex-wrap items-start justify-between gap-2">
						<div className="min-w-0">
							<p className="text-base font-semibold leading-tight">{entry.description}</p>
							<div className="mt-1 flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
								<span>{timeLabel}</span>
								{bucketLabel ? <span>{bucketLabel}</span> : null}
								{entry.type === "planned" ? (
									<span>{entry.isRecurring ? entry.cadenceLabel : labels.oneOff}</span>
								) : null}
							</div>
						</div>
						<Badge variant="outline" className="shrink-0 bg-background/80">
							{entry.points.toLocaleString()} pts
						</Badge>
					</div>
					<div className="flex flex-wrap gap-2">
						<Badge
							variant="secondary"
							className={cn(
								entry.type === "planned"
									? "bg-sky-500/12 text-sky-800"
									: entry.status === "PENDING"
										? "bg-amber-500/12 text-amber-800"
										: "bg-emerald-500/12 text-emerald-800",
							)}
						>
							{entry.type === "planned"
								? labels.planned
								: entry.status === "PENDING"
									? labels.pendingApproval
									: labels.completed}
						</Badge>
					</div>
				</div>
			</div>
		</div>
	);
};
