"use client";

import { useState, useTransition } from "react";

import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/Card";
import { Label } from "@/components/ui/Label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/Select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/Table";
import { useToast } from "@/hooks/useToast";
import {
	type DateFormat,
	DEFAULT_DATE_FORMAT,
	DEFAULT_TIME_FORMAT,
	formatDate,
	formatDateTime,
	type TimeFormat,
} from "@/lib/formatDate";
import { useTranslation } from "@/lib/i18nClient";
import { DEFAULT_TIME_ZONE } from "@/lib/timeZones";
import { trpc } from "@/lib/trpc/react";

type Invite = {
	id: string;
	code: string;
	role: "DICTATOR" | "APPROVER" | "DOER";
	status: "PENDING" | "EXPIRED";
	invitedAt: string;
	expiresAt: string;
	invitedBy: { name: string | null; email: string | null };
};

type Props = {
	householdId: string;
	canInvite: boolean;
	variant?: "card" | "section";
};

export const InvitesCard = ({ householdId, canInvite, variant = "card" }: Props) => {
	const [role, setRole] = useState<Invite["role"]>("DOER");
	const [isPending, startTransition] = useTransition();
	const { toast } = useToast();
	const { t } = useTranslation();
	const isSection = variant === "section";
	const utils = trpc.useUtils();
	const roleLabels = {
		DICTATOR: t("Dictator"),
		APPROVER: t("Approver"),
		DOER: t("Doer"),
	};

	const { data, isLoading } = trpc.households.getInvites.useQuery(
		{ householdId },
		{
			enabled: canInvite,
		},
	);

	const createInviteMutation = trpc.households.createInvite.useMutation({
		onSuccess: () => {
			toast({ title: t("Invite code generated") });
			utils.households.getInvites.invalidate();
		},
		onError: (error) => {
			toast({
				title: t("Unable to send invite"),
				description: error.message ?? t("Please try again."),
				variant: "destructive",
			});
		},
	});

	const manageInviteMutation = trpc.households.manageInvite.useMutation({
		onMutate: async (variables) => {
			await utils.households.getInvites.cancel({ householdId });
			const previousInvites = utils.households.getInvites.getData({ householdId });

			if (variables.action === "revoke") {
				utils.households.getInvites.setData({ householdId }, (old) => {
					if (!old) return old;
					return {
						...old,
						invites: old.invites.filter((invite) => invite.id !== variables.id),
					};
				});
			} else if (variables.action === "resend") {
				utils.households.getInvites.setData({ householdId }, (old) => {
					if (!old) return old;
					return {
						...old,
						invites: old.invites.map((invite) =>
							invite.id === variables.id ? { ...invite, status: "PENDING" as const } : invite,
						),
					};
				});
			}

			return { previousInvites };
		},
		onError: (error, variables, context) => {
			if (context?.previousInvites) {
				utils.households.getInvites.setData({ householdId }, context.previousInvites);
			}
			toast({
				title: variables.action === "revoke" ? t("Unable to revoke invite") : t("Unable to resend invite"),
				description: error.message ?? t("Please try again."),
				variant: "destructive",
			});
		},
		onSuccess: (_, variables) => {
			toast({ title: variables.action === "revoke" ? t("Invite revoked") : t("Invite regenerated") });
		},
		onSettled: () => {
			utils.households.getInvites.invalidate();
		},
	});

	const invites = data?.invites ?? [];
	const dateFormat: DateFormat = data?.household?.dateFormat ?? DEFAULT_DATE_FORMAT;
	const timeFormat: TimeFormat = data?.household?.timeFormat ?? DEFAULT_TIME_FORMAT;
	const timeZone = data?.household?.timeZone ?? DEFAULT_TIME_ZONE;

	if (!canInvite) {
		return null;
	}

	const handleInvite = () => {
		startTransition(async () => {
			await createInviteMutation.mutateAsync({ householdId, role });
		});
	};

	const handleRevoke = (inviteId: string) => {
		startTransition(async () => {
			await manageInviteMutation.mutateAsync({ householdId, id: inviteId, action: "revoke" });
		});
	};

	const handleResend = (inviteId: string) => {
		startTransition(async () => {
			await manageInviteMutation.mutateAsync({ householdId, id: inviteId, action: "resend" });
		});
	};

	const handleCopy = async (code: string) => {
		try {
			await navigator.clipboard.writeText(code);
			toast({ title: t("Invite code copied") });
		} catch (_error) {
			toast({
				title: t("Unable to copy code"),
				description: t("Please copy it manually."),
				variant: "destructive",
			});
		}
	};

	const header = (
		<div className={isSection ? "space-y-1" : undefined}>
			<CardTitle className={isSection ? "text-base" : "text-xl"}>{t("Invites")}</CardTitle>
			<CardDescription>{t("Generate shareable invite codes.")}</CardDescription>
		</div>
	);

	const content = (
		<div className="space-y-4">
			<div className="grid gap-3 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-end">
				<div className="space-y-2">
					<Label>{t("Role")}</Label>
					<Select value={role} onValueChange={(value: Invite["role"]) => setRole(value)} disabled={isPending}>
						<SelectTrigger>
							<SelectValue placeholder={t("Select role")} />
						</SelectTrigger>
						<SelectContent>
							<SelectItem value="DICTATOR">{t("Dictator")}</SelectItem>
							<SelectItem value="APPROVER">{t("Approver")}</SelectItem>
							<SelectItem value="DOER">{t("Doer")}</SelectItem>
						</SelectContent>
					</Select>
				</div>
				<Button type="button" onClick={handleInvite} disabled={isPending}>
					{t("Generate code")}
				</Button>
			</div>

			{isLoading ? (
				<p className="text-sm text-muted-foreground">{t("Loading invites…")}</p>
			) : invites.length === 0 ? (
				<p className="text-sm text-muted-foreground">{t("No invite codes yet.")}</p>
			) : (
				<Table>
					<TableHeader>
						<TableRow>
							<TableHead>{t("Code")}</TableHead>
							<TableHead>{t("Role")}</TableHead>
							<TableHead>{t("Status")}</TableHead>
							<TableHead>{t("Invited")}</TableHead>
							<TableHead className="text-right">{t("Actions")}</TableHead>
						</TableRow>
					</TableHeader>
					<TableBody>
						{invites.map((invite) => (
							<TableRow key={invite.id}>
								<TableCell>
									<div className="flex flex-col">
										<span className="font-medium">{invite.code}</span>
										<span className="text-xs text-muted-foreground">
											{t("Invited by {{name}}", {
												name: invite.invitedBy?.name ?? invite.invitedBy?.email ?? t("Unknown"),
											})}
										</span>
									</div>
								</TableCell>
								<TableCell>
									<Badge variant="secondary">{roleLabels[invite.role]}</Badge>
								</TableCell>
								<TableCell className="text-sm text-muted-foreground">
									{invite.status === "EXPIRED" ? t("Expired") : t("Pending")}
								</TableCell>
								<TableCell className="text-sm text-muted-foreground">
									<div>{formatDateTime(invite.invitedAt, { timeZone, dateFormat, timeFormat })}</div>
									<div className="text-xs text-muted-foreground">
										{t("Expires {{date}}", { date: formatDate(invite.expiresAt, { timeZone, dateFormat }) })}
									</div>
								</TableCell>
								<TableCell className="text-right">
									<div className="flex justify-end gap-2">
										<Button
											type="button"
											variant="outline"
											size="sm"
											disabled={isPending}
											onClick={() => handleCopy(invite.code)}
										>
											{t("Copy")}
										</Button>
										{invite.status === "EXPIRED" ? (
											<Button
												type="button"
												variant="outline"
												size="sm"
												disabled={isPending}
												onClick={() => handleResend(invite.id)}
											>
												{t("Regenerate")}
											</Button>
										) : null}
										<Button
											type="button"
											variant="ghost"
											size="sm"
											disabled={isPending}
											onClick={() => handleRevoke(invite.id)}
										>
											{t("Revoke")}
										</Button>
									</div>
								</TableCell>
							</TableRow>
						))}
					</TableBody>
				</Table>
			)}
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
