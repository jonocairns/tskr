import { CrownIcon, UsersIcon } from "lucide-react";

import { Badge } from "@/components/ui/Badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/Card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/Table";

export type LeaderboardEntry = {
	userId: string;
	name: string;
	email?: string | null;
	points: number;
	currentBalance: number;
	tasks: number;
	claims: number;
	lastActivity?: string | null;
	averagePointsPerDay: number;
};

type Props = {
	entries: LeaderboardEntry[];
};

export const Leaderboard = ({ entries }: Props) => {
	return (
		<Card>
			<CardHeader className="flex flex-row items-center justify-between space-y-0">
				<div>
					<CardTitle className="text-xl">Leaderboard</CardTitle>
					<CardDescription>Average points per day since first task.</CardDescription>
				</div>
				<div className="rounded-full bg-primary/10 p-2 text-primary">
					<UsersIcon className="h-5 w-5" />
				</div>
			</CardHeader>
			<CardContent className="overflow-x-auto">
				<Table>
					<TableHeader>
						<TableRow>
							<TableHead>User</TableHead>
							<TableHead className="text-right">Avg/day</TableHead>
							<TableHead className="text-right text-muted-foreground">Total</TableHead>
							<TableHead className="hidden sm:table-cell text-right text-muted-foreground">Current</TableHead>
							<TableHead className="hidden sm:table-cell text-right">Tasks</TableHead>
							<TableHead className="hidden sm:table-cell text-right">Rewards</TableHead>
							<TableHead className="hidden sm:table-cell text-right">Last active</TableHead>
						</TableRow>
					</TableHeader>
					<TableBody>
						{entries.map((entry, idx) => (
							<TableRow key={entry.userId}>
								<TableCell className="flex items-center gap-2">
									<div className="flex flex-col">
										<span className="font-semibold">{entry.name}</span>
										<span className="text-xs text-muted-foreground">{entry.email ?? "—"}</span>
									</div>
									{idx === 0 ? (
										<Badge className="bg-gradient-to-r from-amber-500 to-orange-500 text-white">
											<CrownIcon className="mr-1 h-3 w-3" />
											Top
										</Badge>
									) : null}
								</TableCell>
								<TableCell className="text-right font-semibold text-sm ">
									{entry.averagePointsPerDay.toFixed(1)}
								</TableCell>
								<TableCell className="text-right text-sm text-muted-foreground">
									{entry.points.toLocaleString()}
								</TableCell>
								<TableCell className="hidden sm:table-cell text-right text-sm text-muted-foreground">
									{entry.currentBalance.toLocaleString()}
								</TableCell>
								<TableCell className="hidden sm:table-cell text-right text-sm text-muted-foreground">
									{entry.tasks}
								</TableCell>
								<TableCell className="hidden sm:table-cell text-right text-sm text-muted-foreground">
									{entry.claims}
								</TableCell>
								<TableCell className="hidden sm:table-cell text-right text-sm text-muted-foreground">
									{entry.lastActivity ? new Date(entry.lastActivity).toLocaleDateString() : "—"}
								</TableCell>
							</TableRow>
						))}
					</TableBody>
				</Table>
			</CardContent>
		</Card>
	);
};
