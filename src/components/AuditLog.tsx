"use client";

import { Undo2Icon } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";

import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/Card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/Table";
import { useToast } from "@/hooks/useToast";
import type { LogKind } from "@/lib/points";
import { trpc } from "@/lib/trpc/react";

export type AuditLogEntry = {
	id: string;
	userId: string;
	userName: string;
	description: string;
	points: number;
	kind: LogKind;
	status?: "PENDING" | "APPROVED" | "REJECTED";
	bucketLabel?: string | null;
	createdAt: string;
	revertedAt?: string | null;
};

type Props = {
	householdId: string;
	entries: AuditLogEntry[];
	currentUserId: string;
	initialHasMore: boolean;
};

export const AuditLog = ({ householdId, entries, currentUserId, initialHasMore }: Props) => {
	const [items, setItems] = useState(entries);
	const [hasMore, setHasMore] = useState(initialHasMore);
	const router = useRouter();
	const { toast } = useToast();
	const utils = trpc.useUtils();

	useEffect(() => {
		setItems(entries);
		setHasMore(initialHasMore);
	}, [entries, initialHasMore]);

	const { mutate: updateStatus, isPending } = trpc.logs.updateStatus.useMutation({
		onSuccess: (_, variables) => {
			const action = variables.action;
			if (action === "revert") {
				toast({
					title: "Entry reverted",
					description: "The points from this entry were removed.",
				});
			} else if (action === "resubmit") {
				toast({
					title: "Resubmitted for approval",
					description: "Your task is waiting for approval.",
				});
			}
			utils.logs.invalidate();
			router.refresh();
		},
		onError: (error, variables) => {
			const action = variables.action;
			if (action === "revert") {
				toast({
					title: "Unable to undo",
					description: error.message ?? "Try again shortly.",
					variant: "destructive",
				});
			} else if (action === "resubmit") {
				toast({
					title: "Unable to resubmit",
					description: error.message ?? "Try again shortly.",
					variant: "destructive",
				});
			}
		},
	});

	const { refetch: loadMoreQuery, isFetching: isLoadingMore } = trpc.logs.getHistory.useQuery(
		{
			householdId,
			offset: items.length,
			limit: 10,
		},
		{
			enabled: false,
		},
	);

	const undo = (id: string) => {
		updateStatus({ id, action: "revert" });
	};

	const resubmit = (id: string) => {
		updateStatus({ id, action: "resubmit" });
	};

	const loadMore = async () => {
		if (isLoadingMore || !hasMore) {
			return;
		}

		try {
			const result = await loadMoreQuery();
			if (result.data) {
				setItems((prev) => [...prev, ...result.data.entries]);
				setHasMore(result.data.hasMore);
			}
		} catch (_error) {
			toast({
				title: "Unable to load more history",
				description: "Please try again shortly.",
				variant: "destructive",
			});
		}
	};

	return (
		<Card>
			<CardHeader>
				<CardTitle className="text-xl">History</CardTitle>
				<CardDescription>Everything recorded, including reward claims and reverts.</CardDescription>
			</CardHeader>
			<CardContent className="overflow-x-auto">
				{items.length === 0 ? (
					<p className="text-sm text-muted-foreground">No activity yet. Start logging tasks.</p>
				) : (
					<Table>
						<TableHeader>
							<TableRow>
								<TableHead>Entry</TableHead>
								<TableHead className="hidden sm:table-cell">Bucket</TableHead>
								<TableHead className="hidden sm:table-cell">Date</TableHead>
								<TableHead className="text-right">Points</TableHead>
								<TableHead className="text-right">Actions</TableHead>
							</TableRow>
						</TableHeader>
						<TableBody>
							{items.map((log) => (
								<TableRow key={log.id} className={log.revertedAt ? "opacity-50" : ""}>
									<TableCell>
										<div className="font-semibold">{log.description}</div>
										<div className="text-xs text-muted-foreground">
											{log.userName}
											{log.status && log.status !== "APPROVED" ? ` · ${log.status.toLowerCase()}` : ""}
										</div>
										<div className="text-xs text-muted-foreground sm:hidden mt-1">
											{log.bucketLabel ? `${log.bucketLabel} · ` : ""}
											{new Date(log.createdAt).toLocaleDateString()}
										</div>
									</TableCell>
									<TableCell className="hidden sm:table-cell">
										<Badge variant="secondary">{log.bucketLabel ?? "—"}</Badge>
									</TableCell>
									<TableCell className="hidden sm:table-cell text-sm text-muted-foreground">
										{new Date(log.createdAt).toLocaleString()}
									</TableCell>
									<TableCell className="text-right font-semibold">
										{log.points > 0 ? "+" : ""}
										{log.points}
									</TableCell>
									<TableCell className="text-right">
										{log.revertedAt ? (
											<span className="text-xs text-muted-foreground">
												<span className="hidden sm:inline">
													Reverted {new Date(log.revertedAt).toLocaleDateString()}
												</span>
												<span className="sm:hidden">Reverted</span>
											</span>
										) : log.status === "REJECTED" && log.userId === currentUserId ? (
											<Button
												variant="ghost"
												size="sm"
												disabled={isPending}
												onClick={() => resubmit(log.id)}
												className="text-muted-foreground hover:text-foreground"
											>
												Resubmit
											</Button>
										) : log.status === "PENDING" ? (
											<span className="text-xs text-muted-foreground">
												<span className="hidden sm:inline">Awaiting approval</span>
												<span className="sm:hidden">Pending</span>
											</span>
										) : (
											<Button
												variant="ghost"
												size="sm"
												disabled={isPending}
												onClick={() => undo(log.id)}
												className="text-muted-foreground hover:text-foreground"
											>
												<Undo2Icon className="h-4 w-4 sm:mr-2" />
												<span className="hidden sm:inline">Undo</span>
											</Button>
										)}
									</TableCell>
								</TableRow>
							))}
						</TableBody>
					</Table>
				)}
				{items.length > 0 ? (
					<div className="flex justify-center pt-4">
						<Button type="button" variant="outline" onClick={loadMore} disabled={!hasMore || isLoadingMore}>
							{isLoadingMore ? "Loading..." : hasMore ? "Load 10 more" : "No more history"}
						</Button>
					</div>
				) : null}
			</CardContent>
		</Card>
	);
};
