import type { ReactNode } from "react";

import { CardContent, CardHeader } from "@/components/ui/Card";
import { DashboardCard } from "@/components/ui/DashboardCard";

type Props = {
	approvedPoints: number;
	completedCount: number;
	pendingCount: number;
	plannedCount: number;
	controls: ReactNode;
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
	pendingCount,
	plannedCount,
	controls,
	labels,
}: Props) => {
	return (
		<DashboardCard>
			<CardHeader>{controls}</CardHeader>
			<CardContent>
				<div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
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
