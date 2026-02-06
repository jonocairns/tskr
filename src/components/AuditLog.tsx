"use client";

import { Undo2Icon } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";

import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/Card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/Table";
import { useToast } from "@/hooks/useToast";
import { type DateFormat, formatDate, formatDateTime, type TimeFormat } from "@/lib/formatDate";
import { useTranslation } from "@/lib/i18nClient";
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
	timeZone: string;
	dateFormat: DateFormat;
	timeFormat: TimeFormat;
};

export const AuditLog = ({
	householdId,
	entries,
	currentUserId,
	initialHasMore,
	timeZone,
	dateFormat,
	timeFormat,
}: Props) => {
	const [items, setItems] = useState(entries);
	const [hasMore, setHasMore] = useState(initialHasMore);
	const router = useRouter();
	const { toast } = useToast();
	const { t } = useTranslation();
	const utils = trpc.useUtils();
	const historyLimit = 10;
	const statusLabels = {
		PENDING: t("Pending"),
		REJECTED: t("Rejected"),
	};

	useEffect(() => {
		setItems(entries);
		setHasMore(initialHasMore);
	}, [entries, initialHasMore]);

	const { mutate: updateStatus, isPending } = trpc.logs.updateStatus.useMutation({
		onSuccess: (_, variables) => {
			const action = variables.action;
			if (action === "revert") {
				toast({
					title: t("Entry reverted"),
					description: t("The points from this entry were removed."),
				});
			} else if (action === "resubmit") {
				toast({
					title: t("Resubmitted for approval"),
					description: t("Your task is waiting for approval."),
				});
			}
			utils.logs.invalidate();
			router.refresh();
		},
		onError: (error, variables) => {
			const action = variables.action;
			if (action === "revert") {
				toast({
					title: t("Unable to undo"),
					description: error.message ?? t("Try again shortly."),
					variant: "destructive",
				});
			} else if (action === "resubmit") {
				toast({
					title: t("Unable to resubmit"),
					description: error.message ?? t("Try again shortly."),
					variant: "destructive",
				});
			}
		},
	});

	const { refetch: loadMoreQuery, isFetching: isLoadingMore } = trpc.logs.getHistory.useQuery(
		{
			householdId,
			offset: items.length,
			limit: historyLimit,
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
				title: t("Unable to load more history"),
				description: t("Please try again shortly."),
				variant: "destructive",
			});
		}
	};

	return (
		<Card>
			<CardHeader>
				<CardTitle className="text-xl">{t("History")}</CardTitle>
				<CardDescription>{t("Everything recorded, including reward claims and reverts.")}</CardDescription>
			</CardHeader>
			<CardContent className="overflow-x-auto">
				{items.length === 0 ? (
					<p className="text-sm text-muted-foreground">{t("No activity yet. Start logging tasks.")}</p>
				) : (
					<Table>
						<TableHeader>
							<TableRow>
								<TableHead>{t("Entry")}</TableHead>
								<TableHead className="hidden sm:table-cell">{t("Bucket")}</TableHead>
								<TableHead className="hidden sm:table-cell">{t("Date")}</TableHead>
								<TableHead className="text-right">{t("Points")}</TableHead>
								<TableHead className="text-right">{t("Actions")}</TableHead>
							</TableRow>
						</TableHeader>
						<TableBody>
							{items.map((log) => (
								<TableRow key={log.id} className={log.revertedAt ? "opacity-50" : ""}>
									<TableCell>
										<div className="font-semibold">{log.description}</div>
										<div className="text-xs text-muted-foreground">
											{log.userName}
											{log.status && log.status !== "APPROVED"
												? ` · ${statusLabels[log.status] ?? log.status.toLowerCase()}`
												: ""}
										</div>
										<div className="text-xs text-muted-foreground sm:hidden mt-1">
											{log.bucketLabel ? `${log.bucketLabel} · ` : ""}
											{formatDate(log.createdAt, { timeZone, dateFormat })}
										</div>
									</TableCell>
									<TableCell className="hidden sm:table-cell">
										<Badge variant="secondary">{log.bucketLabel ?? "—"}</Badge>
									</TableCell>
									<TableCell className="hidden sm:table-cell text-sm text-muted-foreground">
										{formatDateTime(log.createdAt, { timeZone, dateFormat, timeFormat })}
									</TableCell>
									<TableCell className="text-right font-semibold">
										{log.points > 0 ? "+" : ""}
										{log.points}
									</TableCell>
									<TableCell className="text-right">
										{log.revertedAt ? (
											<span className="text-xs text-muted-foreground">
												<span className="hidden sm:inline">
													{t("Reverted {{date}}", {
														date: formatDate(log.revertedAt, { timeZone, dateFormat }),
													})}
												</span>
												<span className="sm:hidden">{t("Reverted")}</span>
											</span>
										) : log.status === "REJECTED" && log.userId === currentUserId ? (
											<Button
												variant="ghost"
												size="sm"
												disabled={isPending}
												onClick={() => resubmit(log.id)}
												className="text-muted-foreground hover:text-foreground"
											>
												{t("Resubmit")}
											</Button>
										) : log.status === "PENDING" ? (
											<span className="text-xs text-muted-foreground">
												<span className="hidden sm:inline">{t("Awaiting approval")}</span>
												<span className="sm:hidden">{t("Pending")}</span>
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
												<span className="hidden sm:inline">{t("Undo")}</span>
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
							{isLoadingMore
								? t("Loading...")
								: hasMore
									? t("Load {{count}} more", { count: historyLimit })
									: t("No more history")}
						</Button>
					</div>
				) : null}
			</CardContent>
		</Card>
	);
};
