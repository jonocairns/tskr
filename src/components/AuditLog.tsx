"use client";

import { Undo2Icon } from "lucide-react";
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
import {
	Table,
	TableBody,
	TableCell,
	TableHead,
	TableHeader,
	TableRow,
} from "@/components/ui/Table";
import { useToast } from "@/hooks/use-toast";
import type { LogKind } from "@/lib/points";

export type AuditLogEntry = {
	id: string;
	userName: string;
	description: string;
	points: number;
	kind: LogKind;
	bucketLabel?: string | null;
	createdAt: string;
	revertedAt?: string | null;
};

type Props = {
	entries: AuditLogEntry[];
};

export const AuditLog = ({ entries }: Props) => {
	const [isPending, startTransition] = useTransition();
	const router = useRouter();
	const { toast } = useToast();

	const undo = (id: string) => {
		startTransition(async () => {
			const res = await fetch(`/api/logs/${id}`, { method: "PATCH" });

			if (!res.ok) {
				const body = await res.json().catch(() => ({}));
				toast({
					title: "Unable to undo",
					description: body?.error ?? "Try again shortly.",
					variant: "destructive",
				});
				return;
			}

			toast({
				title: "Entry reverted",
				description: "The points from this entry were removed.",
			});
			router.refresh();
		});
	};

	return (
		<Card className="mt-4">
			<CardHeader>
				<CardTitle className="text-xl">History</CardTitle>
				<CardDescription>
					Everything recorded, including reward claims and reverts.
				</CardDescription>
			</CardHeader>
			<CardContent className="overflow-x-auto">
				{entries.length === 0 ? (
					<p className="text-sm text-muted-foreground">
						No activity yet. Start logging tasks.
					</p>
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
							{entries.map((log) => (
								<TableRow
									key={log.id}
									className={log.revertedAt ? "opacity-50" : ""}
								>
									<TableCell>
										<div className="font-semibold">{log.description}</div>
										<div className="text-xs text-muted-foreground">
											{log.userName} · {log.kind.toLowerCase()}
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
			</CardContent>
		</Card>
	);
};
