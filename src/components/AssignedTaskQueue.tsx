"use client";

import { CheckIcon } from "lucide-react";
import { useRouter } from "next/navigation";
import { useTransition } from "react";

import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import {
	Card,
	CardContent,
	CardDescription,
	CardHeader,
	CardTitle,
} from "@/components/ui/Card";
import { Progress } from "@/components/ui/Progress";
import {
	Table,
	TableBody,
	TableCell,
	TableHead,
	TableHeader,
	TableRow,
} from "@/components/ui/Table";
import { useToast } from "@/hooks/use-toast";
import { DURATION_BUCKETS, type DurationKey } from "@/lib/points";

export type AssignedTaskEntry = {
	id: string;
	presetId: string;
	label: string;
	bucket: DurationKey;
	points: number;
	assignedAt: string;
	cadenceTarget: number;
	cadenceIntervalMinutes: number;
	isRecurring: boolean;
	progress: number;
};

const CADENCE_LABELS: Record<number, string> = {
	1440: "Daily",
	10080: "Weekly",
	43200: "Monthly",
	129600: "Quarterly",
	525600: "Yearly",
};

const BUCKET_LABELS = Object.fromEntries(
	DURATION_BUCKETS.map((bucket) => [bucket.key, bucket.label]),
);

const formatCadenceInterval = (minutes: number) => {
	if (CADENCE_LABELS[minutes]) {
		return CADENCE_LABELS[minutes];
	}
	if (minutes % 60 === 0) {
		const hours = Math.round(minutes / 60);
		return `Every ${hours}h`;
	}
	return `Every ${minutes}m`;
};

type Props = {
	entries: AssignedTaskEntry[];
};

export const AssignedTaskQueue = ({ entries }: Props) => {
	const [isPending, startTransition] = useTransition();
	const router = useRouter();
	const { toast } = useToast();

	const handleComplete = (taskId: string) => {
		startTransition(async () => {
			const res = await fetch(`/api/assigned-tasks/${taskId}/complete`, {
				method: "POST",
			});

			if (!res.ok) {
				const body = await res.json().catch(() => ({}));
				toast({
					title: "Unable to complete task",
					description: body?.error ?? "Please try again.",
					variant: "destructive",
				});
				return;
			}

			const body = await res.json().catch(() => ({}));
			const isPendingApproval = body?.entry?.status === "PENDING";
			toast({
				title: isPendingApproval ? "Submitted for approval" : "Task completed",
				description: isPendingApproval
					? "Completion logged and waiting on approval."
					: "Completion logged and points added.",
			});
			router.refresh();
		});
	};

	return (
		<Card>
			<CardHeader>
				<CardTitle className="text-xl">Assignments</CardTitle>
				<CardDescription>
					Complete tasks that were assigned to you.
				</CardDescription>
			</CardHeader>
			<CardContent className="overflow-x-auto">
				{entries.length === 0 ? (
					<p className="text-sm text-muted-foreground">
						No assignments right now.
					</p>
				) : (
					<Table>
						<TableHeader>
							<TableRow>
								<TableHead>Task</TableHead>
								<TableHead>Progress</TableHead>
								<TableHead>Cadence</TableHead>
								<TableHead className="text-right">Actions</TableHead>
							</TableRow>
						</TableHeader>
						<TableBody>
							{entries.map((entry) => {
								const target = Math.max(entry.cadenceTarget, 1);
								const progressValue = Math.min(
									100,
									Math.round((entry.progress / target) * 100),
								);
								return (
									<TableRow key={entry.id}>
										<TableCell>
											<div className="flex flex-col gap-1">
												<span className="font-semibold">{entry.label}</span>
												<span className="text-xs text-muted-foreground">
													{entry.points} pts -{" "}
													{BUCKET_LABELS[entry.bucket] ?? entry.bucket}
												</span>
											</div>
										</TableCell>
										<TableCell>
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
									<TableCell>
										<div className="flex items-center gap-2 text-sm">
											<Badge variant="secondary">
												{entry.isRecurring ? "Recurring" : "One-off"}
											</Badge>
											<span className="text-muted-foreground">
												{entry.isRecurring
													? formatCadenceInterval(entry.cadenceIntervalMinutes)
													: "None"}
											</span>
										</div>
									</TableCell>
										<TableCell className="text-right">
											<Button
												type="button"
												size="sm"
												disabled={isPending}
												onClick={() => handleComplete(entry.id)}
											>
												<CheckIcon className="mr-2 h-4 w-4" />
												Complete
											</Button>
										</TableCell>
									</TableRow>
								);
							})}
						</TableBody>
					</Table>
				)}
			</CardContent>
		</Card>
	);
};
