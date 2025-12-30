"use client";

import { useState } from "react";

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
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/Card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/Select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/Table";
import { useToast } from "@/hooks/useToast";
import { useMembers, useUpdateMember } from "@/lib/api/hooks";
import type { Member, Role } from "@/lib/api/schemas";

type Props = {
	householdId: string;
	currentUserId: string;
	canManageMembers: boolean;
	variant?: "card" | "section";
};

export const MembersCard = ({ currentUserId, canManageMembers, variant = "card" }: Props) => {
	const [pendingRoleChange, setPendingRoleChange] = useState<{
		memberId: string;
		role: Role;
	} | null>(null);
	const { toast } = useToast();
	const isSection = variant === "section";

	// Use TanStack Query hooks
	const { data, isLoading, error } = useMembers();
	const updateMemberMutation = useUpdateMember();

	const members = data?.members ?? [];
	const dictatorCount = members.filter((member) => member.role === "DICTATOR").length;

	// Show error toast if query fails
	if (error) {
		toast({
			title: "Unable to load members",
			description: "Please refresh and try again.",
			variant: "destructive",
		});
	}

	const updateMember = (memberId: string, payload: Partial<Pick<Member, "role" | "requiresApprovalDefault">>) => {
		updateMemberMutation.mutate(
			{ id: memberId, data: payload },
			{
				onSuccess: () => {
					toast({ title: "Member updated" });
				},
				onError: (error: Error) => {
					toast({
						title: "Unable to update member",
						description: error.message ?? "Please try again.",
						variant: "destructive",
					});
				},
			},
		);
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
			<CardTitle className={isSection ? "text-base" : "text-xl"}>Members</CardTitle>
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
							const isOnlyDictator = member.role === "DICTATOR" && dictatorCount === 1;
							const roleSelectDisabled = updateMemberMutation.isPending;
							return (
								<TableRow key={member.id}>
									<TableCell>
										<div className="flex flex-col">
											<span className="font-semibold">{member.user.name ?? member.user.email ?? "Unknown"}</span>
											<span className="text-xs text-muted-foreground">{member.user.email ?? "—"}</span>
										</div>
									</TableCell>
									<TableCell>
										{canManageMembers ? (
											<Select
												value={member.role}
												onValueChange={(value: Role) => {
													if (value === member.role) {
														return;
													}
													if (isOnlyDictator && value !== "DICTATOR") {
														toast({
															title: "Keep at least one dictator",
															description: "Promote another member to dictator first.",
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
													<SelectItem value="APPROVER" disabled={isOnlyDictator}>
														Approver
													</SelectItem>
													<SelectItem value="DOER" disabled={isOnlyDictator}>
														Doer
													</SelectItem>
												</SelectContent>
											</Select>
										) : (
											<span className="text-sm text-muted-foreground">{member.role.toLowerCase()}</span>
										)}
									</TableCell>
									<TableCell>
										{canManageMembers ? (
											<Select
												value={member.requiresApprovalDefault ? "require" : "allow"}
												onValueChange={(value: "require" | "allow") =>
													updateMember(member.id, {
														requiresApprovalDefault: value === "require",
													})
												}
												disabled={updateMemberMutation.isPending}
											>
												<SelectTrigger>
													<SelectValue placeholder="Select default" />
												</SelectTrigger>
												<SelectContent>
													<SelectItem value="allow">No approval</SelectItem>
													<SelectItem value="require">Requires approval</SelectItem>
												</SelectContent>
											</Select>
										) : (
											<span className="text-sm text-muted-foreground">
												{member.requiresApprovalDefault ? "requires approval" : "no approval"}
											</span>
										)}
									</TableCell>
									<TableCell className="text-right">{isSelf ? <Badge variant="secondary">You</Badge> : null}</TableCell>
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
							This will remove your dictator access. You will no longer be able to manage settings, members, or invites.
						</AlertDialogDescription>
					</AlertDialogHeader>
					<AlertDialogFooter>
						<AlertDialogCancel>Cancel</AlertDialogCancel>
						<AlertDialogAction
							type="button"
							onClick={handleConfirmRoleChange}
							disabled={updateMemberMutation.isPending}
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
