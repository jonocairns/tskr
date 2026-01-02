"use client";

import { useState, useTransition } from "react";

import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/Card";
import { Label } from "@/components/ui/Label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/Select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/Table";
import { useToast } from "@/hooks/useToast";
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
	const isSection = variant === "section";
	const utils = trpc.useUtils();

	const { data, isLoading } = trpc.households.getInvites.useQuery(
		{ householdId },
		{
			enabled: canInvite,
		},
	);

	const createInviteMutation = trpc.households.createInvite.useMutation({
		onSuccess: () => {
			toast({ title: "Invite code generated" });
			utils.households.getInvites.invalidate();
		},
		onError: (error) => {
			toast({
				title: "Unable to send invite",
				description: error.message ?? "Please try again.",
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
						invites: old.invites.filter((invite) => invite.id !== variables.id),
					};
				});
			} else if (variables.action === "resend") {
				utils.households.getInvites.setData({ householdId }, (old) => {
					if (!old) return old;
					return {
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
				title: variables.action === "revoke" ? "Unable to revoke invite" : "Unable to resend invite",
				description: error.message ?? "Please try again.",
				variant: "destructive",
			});
		},
		onSuccess: (_, variables) => {
			toast({ title: variables.action === "revoke" ? "Invite revoked" : "Invite regenerated" });
		},
		onSettled: () => {
			utils.households.getInvites.invalidate();
		},
	});

	const invites = data?.invites ?? [];

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
			toast({ title: "Invite code copied" });
		} catch (_error) {
			toast({
				title: "Unable to copy code",
				description: "Please copy it manually.",
				variant: "destructive",
			});
		}
	};

	const header = (
		<div className={isSection ? "space-y-1" : undefined}>
			<CardTitle className={isSection ? "text-base" : "text-xl"}>Invites</CardTitle>
			<CardDescription>Generate shareable invite codes.</CardDescription>
		</div>
	);

	const content = (
		<div className="space-y-4">
			<div className="grid gap-3 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-end">
				<div className="space-y-2">
					<Label>Role</Label>
					<Select value={role} onValueChange={(value: Invite["role"]) => setRole(value)} disabled={isPending}>
						<SelectTrigger>
							<SelectValue placeholder="Select role" />
						</SelectTrigger>
						<SelectContent>
							<SelectItem value="DICTATOR">Dictator</SelectItem>
							<SelectItem value="APPROVER">Approver</SelectItem>
							<SelectItem value="DOER">Doer</SelectItem>
						</SelectContent>
					</Select>
				</div>
				<Button type="button" onClick={handleInvite} disabled={isPending}>
					Generate code
				</Button>
			</div>

			{isLoading ? (
				<p className="text-sm text-muted-foreground">Loading invites…</p>
			) : invites.length === 0 ? (
				<p className="text-sm text-muted-foreground">No invite codes yet.</p>
			) : (
				<Table>
					<TableHeader>
						<TableRow>
							<TableHead>Code</TableHead>
							<TableHead>Role</TableHead>
							<TableHead>Status</TableHead>
							<TableHead>Invited</TableHead>
							<TableHead className="text-right">Actions</TableHead>
						</TableRow>
					</TableHeader>
					<TableBody>
						{invites.map((invite) => (
							<TableRow key={invite.id}>
								<TableCell>
									<div className="flex flex-col">
										<span className="font-medium">{invite.code}</span>
										<span className="text-xs text-muted-foreground">
											Invited by {invite.invitedBy?.name ?? invite.invitedBy?.email ?? "Unknown"}
										</span>
									</div>
								</TableCell>
								<TableCell>
									<Badge variant="secondary">{invite.role.toLowerCase()}</Badge>
								</TableCell>
								<TableCell className="text-sm text-muted-foreground">
									{invite.status === "EXPIRED" ? "Expired" : "Pending"}
								</TableCell>
								<TableCell className="text-sm text-muted-foreground">
									<div>{new Date(invite.invitedAt).toLocaleString()}</div>
									<div className="text-xs text-muted-foreground">
										Expires {new Date(invite.expiresAt).toLocaleDateString()}
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
											Copy
										</Button>
										{invite.status === "EXPIRED" ? (
											<Button
												type="button"
												variant="outline"
												size="sm"
												disabled={isPending}
												onClick={() => handleResend(invite.id)}
											>
												Regenerate
											</Button>
										) : null}
										<Button
											type="button"
											variant="ghost"
											size="sm"
											disabled={isPending}
											onClick={() => handleRevoke(invite.id)}
										>
											Revoke
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
