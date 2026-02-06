"use client";

import { useState, useTransition } from "react";

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
import { useTranslation } from "@/lib/i18nClient";
import { trpc } from "@/lib/trpc/react";

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

export const MembersCard = ({ householdId, currentUserId, canManageMembers, variant = "card" }: Props) => {
	const [isPending, startTransition] = useTransition();
	const [pendingRoleChange, setPendingRoleChange] = useState<{
		memberId: string;
		role: Member["role"];
	} | null>(null);
	const { toast } = useToast();
	const { t } = useTranslation();
	const isSection = variant === "section";
	const utils = trpc.useUtils();
	const roleLabels = {
		DICTATOR: t("Dictator"),
		APPROVER: t("Approver"),
		DOER: t("Doer"),
	};

	const { data, isLoading } = trpc.households.getMembers.useQuery({ householdId });

	const updateMemberMutation = trpc.households.updateMember.useMutation({
		onSuccess: () => {
			toast({ title: t("Member updated") });
			utils.households.getMembers.invalidate();
		},
		onError: (error) => {
			toast({
				title: t("Unable to update member"),
				description: error.message ?? t("Please try again."),
				variant: "destructive",
			});
		},
	});

	const members = data?.members ?? [];
	const dictatorCount = members.filter((member) => member.role === "DICTATOR").length;

	const updateMember = (memberId: string, payload: Partial<Pick<Member, "role" | "requiresApprovalDefault">>) => {
		startTransition(async () => {
			await updateMemberMutation.mutateAsync({ householdId, id: memberId, ...payload });
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
			<CardTitle className={isSection ? "text-base" : "text-xl"}>{t("Members")}</CardTitle>
			<CardDescription>{t("Roles and approval defaults.")}</CardDescription>
		</div>
	);

	const content = (
		<div className="overflow-x-auto">
			{isLoading ? (
				<p className="text-sm text-muted-foreground">{t("Loading members…")}</p>
			) : members.length === 0 ? (
				<p className="text-sm text-muted-foreground">{t("No members found.")}</p>
			) : (
				<Table>
					<TableHeader>
						<TableRow>
							<TableHead>{t("Member")}</TableHead>
							<TableHead>{t("Role")}</TableHead>
							<TableHead>{t("Approval default")}</TableHead>
							<TableHead className="text-right">{t("Status")}</TableHead>
						</TableRow>
					</TableHeader>
					<TableBody>
						{members.map((member) => {
							const isSelf = member.userId === currentUserId;
							const isOnlyDictator = member.role === "DICTATOR" && dictatorCount === 1;
							const roleSelectDisabled = isPending;
							return (
								<TableRow key={member.id}>
									<TableCell>
										<div className="flex flex-col">
											<span className="font-semibold">{member.user.name ?? member.user.email ?? t("Unknown")}</span>
											<span className="text-xs text-muted-foreground">{member.user.email ?? "—"}</span>
										</div>
									</TableCell>
									<TableCell>
										{canManageMembers ? (
											<Select
												value={member.role}
												onValueChange={(value: "DICTATOR" | "APPROVER" | "DOER") => {
													if (value === member.role) {
														return;
													}
													if (isOnlyDictator && value !== "DICTATOR") {
														toast({
															title: t("Keep at least one dictator"),
															description: t("Promote another member to dictator first."),
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
													<SelectValue placeholder={t("Select role")} />
												</SelectTrigger>
												<SelectContent>
													<SelectItem value="DICTATOR">{t("Dictator")}</SelectItem>
													<SelectItem value="APPROVER" disabled={isOnlyDictator}>
														{t("Approver")}
													</SelectItem>
													<SelectItem value="DOER" disabled={isOnlyDictator}>
														{t("Doer")}
													</SelectItem>
												</SelectContent>
											</Select>
										) : (
											<span className="text-sm text-muted-foreground">{roleLabels[member.role]}</span>
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
												disabled={isPending}
											>
												<SelectTrigger>
													<SelectValue placeholder={t("Select default")} />
												</SelectTrigger>
												<SelectContent>
													<SelectItem value="allow">{t("No approval")}</SelectItem>
													<SelectItem value="require">{t("Requires approval")}</SelectItem>
												</SelectContent>
											</Select>
										) : (
											<span className="text-sm text-muted-foreground">
												{member.requiresApprovalDefault ? t("Requires approval") : t("No approval")}
											</span>
										)}
									</TableCell>
									<TableCell className="text-right">
										{isSelf ? <Badge variant="secondary">{t("You")}</Badge> : null}
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
						<AlertDialogTitle>{t("Change your role?")}</AlertDialogTitle>
						<AlertDialogDescription>
							{t(
								"This will remove your dictator access. You will no longer be able to manage settings, members, or invites.",
							)}
						</AlertDialogDescription>
					</AlertDialogHeader>
					<AlertDialogFooter>
						<AlertDialogCancel>{t("Cancel")}</AlertDialogCancel>
						<AlertDialogAction
							type="button"
							onClick={handleConfirmRoleChange}
							disabled={isPending}
							className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
						>
							{t("Confirm change")}
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
