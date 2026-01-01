"use client";

import { Undo2Icon } from "lucide-react";
import { useParams, useRouter } from "next/navigation";
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
	entries: AuditLogEntry[];
	currentUserId: string;
	initialHasMore: boolean;
};

export const AuditLog = ({ entries, currentUserId, initialHasMore }: Props) => {
	const params = useParams<{ householdId: string }>();
	const householdId = params.householdId;
	const [items, setItems] = useState(entries);
	const [hasMore, setHasMore] = useState(initialHasMore);
	const router = useRouter();
	const { toast } = useToast();
	const utils = trpc.useUtils();

	useEffect(() => {
		setItems(entries);
		setHasMore(initialHasMore);
	}, [entries, initialHasMore]);

	const updateMutation = trpc.logs.updateStatus.useMutation({
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
		updateMutation.mutate({ householdId, id, action: "revert" });
	};

	const resubmit = (id: string) => {
		updateMutation.mutate({ householdId, id, action: "resubmit" });
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

	const isPending = updateMutation.isPending;

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
								<TableHead>Bucket</TableHead>
								<TableHead>Date</TableHead>
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
											{log.userName} · {log.kind.toLowerCase()}
											{log.status && log.status !== "APPROVED" ? ` · ${log.status.toLowerCase()}` : ""}
										</div>
									</TableCell>
									<TableCell>
										<Badge variant="secondary">{log.bucketLabel ?? "—"}</Badge>
									</TableCell>
									<TableCell className="text-sm text-muted-foreground">
										{new Date(log.createdAt).toLocaleString()}
									</TableCell>
									<TableCell className="text-right font-semibold">
										{log.points > 0 ? "+" : ""}
										{log.points}
									</TableCell>
									<TableCell className="text-right">
										{log.revertedAt ? (
											<span className="text-xs text-muted-foreground">
												Reverted {new Date(log.revertedAt).toLocaleDateString()}
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
											<span className="text-xs text-muted-foreground">Awaiting approval</span>
										) : (
											<Button
												variant="ghost"
												size="sm"
												disabled={isPending}
												onClick={() => undo(log.id)}
												className="text-muted-foreground hover:text-foreground"
											>
												<Undo2Icon className="mr-2 h-4 w-4" />
												Undo
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
