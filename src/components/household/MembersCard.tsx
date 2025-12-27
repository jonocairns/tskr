"use client";

import { useEffect, useState, useTransition } from "react";

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
import {
	Card,
	CardContent,
	CardDescription,
	CardHeader,
	CardTitle,
} from "@/components/ui/Card";
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from "@/components/ui/Select";
import {
	Table,
	TableBody,
	TableCell,
	TableHead,
	TableHeader,
	TableRow,
} from "@/components/ui/Table";
import { useToast } from "@/hooks/use-toast";

type Member = {
	id: string;
	userId: string;
	role: "DICTATOR" | "APPROVER" | "DOER";
	requiresApprovalDefault: boolean;
	user: { name: string | null; email: string | null; image: string | null };
};

type Props = {
	householdId: string;
	currentUserId: string;
	canManageMembers: boolean;
	variant?: "card" | "section";
};

export const MembersCard = ({
	currentUserId,
	canManageMembers,
	variant = "card",
}: Props) => {
	const [members, setMembers] = useState<Member[]>([]);
	const [isLoading, setIsLoading] = useState(true);
	const [isPending, startTransition] = useTransition();
	const [pendingRoleChange, setPendingRoleChange] = useState<{
		memberId: string;
		role: Member["role"];
	} | null>(null);
	const { toast } = useToast();
	const isSection = variant === "section";
	const dictatorCount = members.filter(
		(member) => member.role === "DICTATOR",
	).length;

	useEffect(() => {
		let isActive = true;

		const load = async () => {
			setIsLoading(true);
			try {
				const res = await fetch("/api/households/members");
				if (!res.ok) {
					throw new Error("Failed to load members");
				}
				const data = await res.json().catch(() => ({}));
				if (!isActive) {
					return;
				}
				setMembers(Array.isArray(data?.members) ? data.members : []);
			} catch (error) {
				if (isActive) {
					toast({
						title: "Unable to load members",
						description: "Please refresh and try again.",
						variant: "destructive",
					});
				}
			} finally {
				if (isActive) {
					setIsLoading(false);
				}
			}
		};

		load();

		return () => {
			isActive = false;
		};
	}, [toast]);

	const updateMember = (
		memberId: string,
		payload: Partial<Pick<Member, "role" | "requiresApprovalDefault">>,
	) => {
		startTransition(async () => {
			const res = await fetch(`/api/households/members/${memberId}`, {
				method: "PATCH",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify(payload),
			});

			if (!res.ok) {
				const body = await res.json().catch(() => ({}));
				toast({
					title: "Unable to update member",
					description: body?.error ?? "Please try again.",
					variant: "destructive",
				});
				return;
			}

			const body = await res.json().catch(() => ({}));
			if (body?.member) {
				setMembers((prev) =>
					prev.map((member) =>
						member.id === body.member.id
							? { ...member, ...body.member }
							: member,
					),
				);
			}
			toast({ title: "Member updated" });
		});
	};

	const handleConfirmRoleChange = () => {
		if (!pendingRoleChange) {
			return;
		}
		updateMember(pendingRoleChange.memberId, {
			role: pendingRoleChange.role,
		});
		setPendingRoleChange(null);
	};

	const header = (
		<div className={isSection ? "space-y-1" : undefined}>
			<CardTitle className={isSection ? "text-base" : "text-xl"}>
				Members
			</CardTitle>
			<CardDescription>Roles and approval defaults.</CardDescription>
		</div>
	);

	const content = (
		<div className="overflow-x-auto">
			{isLoading ? (
				<p className="text-sm text-muted-foreground">Loading members…</p>
			) : members.length === 0 ? (
				<p className="text-sm text-muted-foreground">No members found.</p>
			) : (
				<Table>
					<TableHeader>
						<TableRow>
							<TableHead>Member</TableHead>
							<TableHead>Role</TableHead>
							<TableHead>Approval default</TableHead>
							<TableHead className="text-right">Status</TableHead>
						</TableRow>
					</TableHeader>
					<TableBody>
						{members.map((member) => {
							const isSelf = member.userId === currentUserId;
							const isOnlyDictator =
								member.role === "DICTATOR" && dictatorCount === 1;
							const roleSelectDisabled = isPending;
							return (
								<TableRow key={member.id}>
									<TableCell>
										<div className="flex flex-col">
											<span className="font-semibold">
												{member.user.name ?? member.user.email ?? "Unknown"}
											</span>
											<span className="text-xs text-muted-foreground">
												{member.user.email ?? "—"}
											</span>
										</div>
									</TableCell>
									<TableCell>
										{canManageMembers ? (
											<Select
												value={member.role}
												onValueChange={(
													value: "DICTATOR" | "APPROVER" | "DOER",
												) => {
													if (value === member.role) {
														return;
													}
													if (isOnlyDictator && value !== "DICTATOR") {
														toast({
															title: "Keep at least one dictator",
															description:
																"Promote another member to dictator first.",
															variant: "destructive",
														});
														return;
													}
													if (isSelf && value !== "DICTATOR") {
														setPendingRoleChange({
															memberId: member.id,
															role: value,
														});
														return;
													}
													updateMember(member.id, { role: value });
												}}
												disabled={roleSelectDisabled}
											>
												<SelectTrigger>
													<SelectValue placeholder="Select role" />
												</SelectTrigger>
												<SelectContent>
													<SelectItem value="DICTATOR">Dictator</SelectItem>
													<SelectItem
														value="APPROVER"
														disabled={isOnlyDictator}
													>
														Approver
													</SelectItem>
													<SelectItem value="DOER" disabled={isOnlyDictator}>
														Doer
													</SelectItem>
												</SelectContent>
											</Select>
										) : (
											<span className="text-sm text-muted-foreground">
												{member.role.toLowerCase()}
											</span>
										)}
									</TableCell>
									<TableCell>
										{canManageMembers ? (
											<Select
												value={
													member.requiresApprovalDefault ? "require" : "allow"
												}
												onValueChange={(value: "require" | "allow") =>
													updateMember(member.id, {
														requiresApprovalDefault: value === "require",
													})
												}
												disabled={isPending}
											>
												<SelectTrigger>
													<SelectValue placeholder="Select default" />
												</SelectTrigger>
												<SelectContent>
													<SelectItem value="allow">No approval</SelectItem>
													<SelectItem value="require">
														Requires approval
													</SelectItem>
												</SelectContent>
											</Select>
										) : (
											<span className="text-sm text-muted-foreground">
												{member.requiresApprovalDefault
													? "requires approval"
													: "no approval"}
											</span>
										)}
									</TableCell>
									<TableCell className="text-right">
										{isSelf ? <Badge variant="secondary">You</Badge> : null}
									</TableCell>
								</TableRow>
							);
						})}
					</TableBody>
				</Table>
			)}
			<AlertDialog
				open={Boolean(pendingRoleChange)}
				onOpenChange={(open) => {
					if (!open) {
						setPendingRoleChange(null);
					}
				}}
			>
				<AlertDialogContent>
					<AlertDialogHeader>
						<AlertDialogTitle>Change your role?</AlertDialogTitle>
						<AlertDialogDescription>
							This will remove your dictator access. You will no longer be able
							to manage settings, members, or invites.
						</AlertDialogDescription>
					</AlertDialogHeader>
					<AlertDialogFooter>
						<AlertDialogCancel>Cancel</AlertDialogCancel>
						<AlertDialogAction
							type="button"
							onClick={handleConfirmRoleChange}
							disabled={isPending}
							className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
						>
							Confirm change
						</AlertDialogAction>
					</AlertDialogFooter>
				</AlertDialogContent>
			</AlertDialog>
		</div>
	);

	if (isSection) {
		return (
			<section className="space-y-3">
				{header}
				{content}
			</section>
		);
	}

	return (
		<Card>
			<CardHeader>{header}</CardHeader>
			<CardContent>{content}</CardContent>
		</Card>
	);
};
