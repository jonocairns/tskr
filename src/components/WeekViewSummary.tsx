import { CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/Card";
import { DashboardCard } from "@/components/ui/DashboardCard";
import { type DateFormat, formatDate } from "@/lib/formatDate";
import { addDaysInTimeZone } from "@/lib/timeZones";
import type { WeekViewRange } from "@/lib/week-view/buildTimeline";

type Props = {
	approvedPoints: number;
	completedCount: number;
	dateFormat: DateFormat;
	pendingCount: number;
	plannedCount: number;
	range: WeekViewRange;
	timeZone: string;
	title: string;
	labels: {
		completed: string;
		approvedPoints: string;
		pendingApproval: string;
		planned: string;
	};
};

export const WeekViewSummary = ({
	approvedPoints,
	completedCount,
	dateFormat,
	pendingCount,
	plannedCount,
	range,
	timeZone,
	title,
	labels,
}: Props) => {
	const endDate = addDaysInTimeZone(range.end, -1, timeZone);
	const rangeLabel = `${formatDate(range.start, { timeZone, dateFormat })} - ${formatDate(endDate, {
		timeZone,
		dateFormat,
	})}`;

	return (
		<DashboardCard>
			<CardHeader>
				<CardTitle className="text-xl">{title}</CardTitle>
				<CardDescription>{rangeLabel}</CardDescription>
			</CardHeader>
			<CardContent>
				<div className="grid grid-cols-2 gap-4 rounded-lg border bg-card/70 p-4 sm:grid-cols-4">
					<Stat label={labels.completed} value={completedCount.toLocaleString()} />
					<Stat label={labels.pendingApproval} value={pendingCount.toLocaleString()} />
					<Stat label={labels.approvedPoints} value={`${approvedPoints.toLocaleString()} pts`} />
					<Stat label={labels.planned} value={plannedCount.toLocaleString()} />
				</div>
			</CardContent>
		</DashboardCard>
	);
};

const Stat = ({ label, value }: { label: string; value: string }) => {
	return (
		<div className="space-y-1">
			<p className="text-sm text-muted-foreground">{label}</p>
			<p className="text-2xl font-semibold">{value}</p>
		</div>
	);
};
