"use client";

import { CheckIcon, XIcon } from "lucide-react";
import { useRouter } from "next/navigation";
import { useTransition } from "react";

import { Button } from "@/components/ui/Button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/Card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/Table";
import { useToast } from "@/hooks/useToast";

export type ApprovalEntry = {
	id: string;
	userId: string;
	userName: string;
	description: string;
	points: number;
	createdAt: string;
};

type Props = {
	entries: ApprovalEntry[];
	currentUserId: string;
};

export const ApprovalQueue = ({ entries, currentUserId }: Props) => {
	const [isPending, startTransition] = useTransition();
	const router = useRouter();
	const { toast } = useToast();

	const actOnEntry = (id: string, action: "approve" | "reject") => {
		startTransition(async () => {
			const res = await fetch(`/api/logs/${id}`, {
				method: "PATCH",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({ action }),
			});

			if (!res.ok) {
				const body = await res.json().catch(() => ({}));
				toast({
					title: action === "approve" ? "Unable to approve" : "Unable to reject",
					description: body?.error ?? "Please try again.",
					variant: "destructive",
				});
				return;
			}

			toast({
				title: action === "approve" ? "Task approved" : "Task rejected",
			});
			router.refresh();
		});
	};

	return (
		<Card>
			<CardHeader>
				<CardTitle className="text-xl">Approvals</CardTitle>
				<CardDescription>Review pending tasks.</CardDescription>
			</CardHeader>
			<CardContent className="overflow-x-auto">
				{entries.length === 0 ? (
					<p className="text-sm text-muted-foreground">No tasks awaiting approval.</p>
				) : (
					<Table>
						<TableHeader>
							<TableRow>
								<TableHead>Entry</TableHead>
								<TableHead>Date</TableHead>
								<TableHead className="text-right">Points</TableHead>
								<TableHead className="text-right">Actions</TableHead>
							</TableRow>
						</TableHeader>
						<TableBody>
							{entries.map((entry) => (
								<TableRow key={entry.id}>
									<TableCell>
										<div className="font-semibold">{entry.description}</div>
										<div className="text-xs text-muted-foreground">{entry.userName}</div>
									</TableCell>
									<TableCell className="text-sm text-muted-foreground">
										{new Date(entry.createdAt).toLocaleString()}
									</TableCell>
									<TableCell className="text-right font-semibold">
										{entry.points > 0 ? "+" : ""}
										{entry.points}
									</TableCell>
									<TableCell className="text-right">
										<div className="flex justify-end gap-2">
											<Button
												type="button"
												variant="outline"
												size="sm"
												disabled={isPending}
												onClick={() => actOnEntry(entry.id, "reject")}
											>
												<XIcon className="mr-2 h-4 w-4" />
												Reject
											</Button>
											<Button
												type="button"
												size="sm"
												disabled={isPending || entry.userId === currentUserId}
												onClick={() => actOnEntry(entry.id, "approve")}
											>
												<CheckIcon className="mr-2 h-4 w-4" />
												Approve
											</Button>
										</div>
									</TableCell>
								</TableRow>
							))}
						</TableBody>
					</Table>
				)}
			</CardContent>
		</Card>
	);
};
