"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useSession } from "next-auth/react";
import { useEffect, useMemo, useState, useTransition } from "react";

import {
	AlertDialog,
	AlertDialogAction,
	AlertDialogCancel,
	AlertDialogContent,
	AlertDialogDescription,
	AlertDialogFooter,
	AlertDialogHeader,
	AlertDialogTitle,
} from "@/components/ui/AlertDialog";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/Card";
import { Label } from "@/components/ui/Label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/Select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/Table";
import { useToast } from "@/hooks/useToast";
import { requestJson } from "@/lib/requestJson";

type HouseholdSummary = {
	id: string;
	name: string;
	role: "DICTATOR" | "APPROVER" | "DOER";
	isOwner: boolean;
	isActive: boolean;
	isLastDictator: boolean;
};

type Member = {
	id: string;
	userId: string;
	role: "DICTATOR" | "APPROVER" | "DOER";
	user: { name: string | null; email: string | null };
};

type Props = {
	households: HouseholdSummary[];
	currentUserId: string;
};

export const HouseholdDirectory = ({ households, currentUserId }: Props) => {
	const [leaveTarget, setLeaveTarget] = useState<HouseholdSummary | null>(null);
	const [transferTarget, setTransferTarget] = useState<HouseholdSummary | null>(null);
	const [transferMembers, setTransferMembers] = useState<Member[]>([]);
	const [transferMemberId, setTransferMemberId] = useState("");
	const [isTransferLoading, setIsTransferLoading] = useState(false);
	const [isPending, startTransition] = useTransition();
	const { toast } = useToast();
	const router = useRouter();
	const { update } = useSession();

	const selectableTransferMembers = useMemo(
		() => transferMembers.filter((member) => member.userId !== currentUserId),
		[currentUserId, transferMembers],
	);

	useEffect(() => {
		if (!transferTarget) {
			setTransferMembers([]);
			setTransferMemberId("");
			setIsTransferLoading(false);
			return;
		}

		let isActive = true;
		setIsTransferLoading(true);

		const loadMembers = async () => {
			const { res, data } = await requestJson<{ members?: Member[]; error?: string }>(
				`/api/households/${transferTarget.id}/members`,
			);

			if (!isActive) {
				return;
			}

			if (!res.ok) {
				toast({
					title: "Unable to load members",
					description: data?.error ?? "Please try again.",
					variant: "destructive",
				});
				setTransferMembers([]);
				return;
			}

			setTransferMembers(Array.isArray(data?.members) ? data.members : []);
		};

		loadMembers().finally(() => {
			if (isActive) {
				setIsTransferLoading(false);
			}
		});

		return () => {
			isActive = false;
		};
	}, [toast, transferTarget]);

	const handleLeave = () => {
		const target = leaveTarget;

		if (!target?.id) {
			if (leaveTarget) {
				toast({
					title: "Unable to leave household",
					description: "Missing household information. Please refresh and try again.",
					variant: "destructive",
				});
			}
			return;
		}

		startTransition(async () => {
			const endpoint = target.isLastDictator
				? `/api/households/${target.id}`
				: `/api/households/${target.id}/leave`;
			const method = target.isLastDictator ? "DELETE" : "POST";
			const { res, data } = await requestJson<{ deleted?: boolean; error?: string }>(endpoint, { method });

			if (!res.ok) {
				toast({
					title: target.isLastDictator ? "Unable to delete household" : "Unable to leave household",
					description: data?.error ?? "Please try again.",
					variant: "destructive",
				});
				return;
			}

			toast({ title: target.isLastDictator || data?.deleted ? "Household deleted" : "Left household" });
			setLeaveTarget(null);
			await update();
			router.refresh();
		});
	};

	const handleTransfer = () => {
		if (!transferTarget || !transferMemberId) {
			return;
		}

		startTransition(async () => {
			const { res, data } = await requestJson<{ error?: string }>(`/api/households/${transferTarget.id}/transfer`, {
				method: "POST",
				body: { memberId: transferMemberId },
			});

			if (!res.ok) {
				toast({
					title: "Unable to transfer ownership",
					description: data?.error ?? "Please try again.",
					variant: "destructive",
				});
				return;
			}

			toast({ title: "Ownership transferred" });
			setTransferTarget(null);
			setTransferMemberId("");
			router.refresh();
		});
	};

	const leaveActionLabel = leaveTarget?.isLastDictator ? "Delete household" : "Leave household";
	const leaveTitle = leaveTarget?.isLastDictator ? "Delete household?" : "Leave household?";
	const leaveDescription = leaveTarget?.isLastDictator
		? "You are the last dictator. Leaving will delete this household for everyone."
		: "You will lose access to tasks and settings for this household.";

	const transferActionDisabled =
		isPending || isTransferLoading || selectableTransferMembers.length === 0 || transferMemberId.length === 0;

	return (
		<Card>
			<CardHeader>
				<CardTitle className="text-xl">Households</CardTitle>
				<CardDescription>Manage memberships and ownership.</CardDescription>
			</CardHeader>
			<CardContent className="space-y-4">
				{households.length === 0 ? (
					<p className="text-sm text-muted-foreground">You are not a member of any households yet.</p>
				) : (
					<Table>
						<TableHeader>
							<TableRow>
								<TableHead>Household</TableHead>
								<TableHead>Role</TableHead>
								<TableHead className="text-right">Actions</TableHead>
							</TableRow>
						</TableHeader>
						<TableBody>
							{households.map((household) => (
								<TableRow key={household.id}>
									<TableCell>
										<div className="flex flex-wrap items-center gap-2">
											<span className="font-semibold">{household.name}</span>
											{household.isActive ? <Badge variant="secondary">Active</Badge> : null}
											{household.isOwner ? <Badge variant="secondary">Owner</Badge> : null}
										</div>
									</TableCell>
									<TableCell>
										<span className="text-sm text-muted-foreground">{household.role.toLowerCase()}</span>
									</TableCell>
									<TableCell className="text-right">
										<div className="flex flex-wrap justify-end gap-2">
											<Button asChild size="sm" variant="outline">
												<Link href={`/household/${household.id}`}>Open</Link>
											</Button>
											{household.role === "DICTATOR" ? (
												<Button
													type="button"
													size="sm"
													variant="secondary"
													onClick={() => setTransferTarget(household)}
													disabled={isPending}
												>
													Transfer
												</Button>
											) : null}
											<Button
												type="button"
												size="sm"
												variant={household.isLastDictator ? "destructive" : "outline"}
												onClick={() => setLeaveTarget(household)}
												disabled={isPending}
											>
												{household.isLastDictator ? "Delete" : "Leave"}
											</Button>
										</div>
									</TableCell>
								</TableRow>
							))}
						</TableBody>
					</Table>
				)}
			</CardContent>

			<AlertDialog
				open={Boolean(leaveTarget)}
				onOpenChange={(open) => {
					if (!open) {
						setLeaveTarget(null);
					}
				}}
			>
				<AlertDialogContent>
					<AlertDialogHeader>
						<AlertDialogTitle>{leaveTitle}</AlertDialogTitle>
						<AlertDialogDescription>{leaveDescription}</AlertDialogDescription>
					</AlertDialogHeader>
					<AlertDialogFooter>
						<AlertDialogCancel disabled={isPending}>Cancel</AlertDialogCancel>
						<AlertDialogAction
							type="button"
							onClick={handleLeave}
							disabled={isPending}
							className={
								leaveTarget?.isLastDictator
									? "bg-destructive text-destructive-foreground hover:bg-destructive/90"
									: undefined
							}
						>
							{isPending ? "Working..." : leaveActionLabel}
						</AlertDialogAction>
					</AlertDialogFooter>
				</AlertDialogContent>
			</AlertDialog>

			<AlertDialog
				open={Boolean(transferTarget)}
				onOpenChange={(open) => {
					if (!open) {
						setTransferTarget(null);
					}
				}}
			>
				<AlertDialogContent>
					<AlertDialogHeader>
						<AlertDialogTitle>Transfer ownership?</AlertDialogTitle>
						<AlertDialogDescription>
							Select a member to become the new owner. They will be promoted to dictator.
						</AlertDialogDescription>
					</AlertDialogHeader>
					<div className="space-y-2">
						<Label htmlFor="transfer-member">New owner</Label>
						{isTransferLoading ? (
							<p className="text-sm text-muted-foreground">Loading members...</p>
						) : selectableTransferMembers.length === 0 ? (
							<p className="text-sm text-muted-foreground">Invite another member before transferring ownership.</p>
						) : (
							<Select value={transferMemberId} onValueChange={setTransferMemberId} disabled={isPending}>
								<SelectTrigger id="transfer-member">
									<SelectValue placeholder="Select a member" />
								</SelectTrigger>
								<SelectContent>
									{selectableTransferMembers.map((member) => (
										<SelectItem key={member.id} value={member.id}>
											{member.user.name ?? member.user.email ?? "Member"}
										</SelectItem>
									))}
								</SelectContent>
							</Select>
						)}
					</div>
					<AlertDialogFooter>
						<AlertDialogCancel disabled={isPending}>Cancel</AlertDialogCancel>
						<AlertDialogAction type="button" onClick={handleTransfer} disabled={transferActionDisabled}>
							{isPending ? "Transferring..." : "Transfer ownership"}
						</AlertDialogAction>
					</AlertDialogFooter>
				</AlertDialogContent>
			</AlertDialog>
		</Card>
	);
};
