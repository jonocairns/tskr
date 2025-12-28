"use client";

import { useEffect, useState, useTransition } from "react";

import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/Card";
import { Label } from "@/components/ui/Label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/Select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/Table";
import { useToast } from "@/hooks/use-toast";

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

export const InvitesCard = ({ canInvite, variant = "card" }: Props) => {
	const [invites, setInvites] = useState<Invite[]>([]);
	const [role, setRole] = useState<Invite["role"]>("DOER");
	const [isLoading, setIsLoading] = useState(true);
	const [isPending, startTransition] = useTransition();
	const { toast } = useToast();
	const isSection = variant === "section";

	useEffect(() => {
		if (!canInvite) {
			return;
		}

		let isActive = true;

		const load = async () => {
			setIsLoading(true);
			try {
				const res = await fetch("/api/households/invites");
				if (!res.ok) {
					throw new Error("Failed to load invites");
				}
				const data = await res.json().catch(() => ({}));
				if (!isActive) {
					return;
				}
				setInvites(Array.isArray(data?.invites) ? data.invites : []);
			} catch (error) {
				if (isActive) {
					toast({
						title: "Unable to load invites",
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
	}, [canInvite, toast]);

	if (!canInvite) {
		return null;
	}

	const handleInvite = () => {
		startTransition(async () => {
			const res = await fetch("/api/households/invites", {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({ role }),
			});

			if (!res.ok) {
				const body = await res.json().catch(() => ({}));
				toast({
					title: "Unable to send invite",
					description: body?.error ?? "Please try again.",
					variant: "destructive",
				});
				return;
			}

			const body = await res.json().catch(() => ({}));
			if (body?.invite) {
				setInvites((prev) => [body.invite, ...prev]);
			}
			toast({ title: "Invite code generated" });
		});
	};

	const handleRevoke = (inviteId: string) => {
		startTransition(async () => {
			const res = await fetch(`/api/households/invites/${inviteId}`, {
				method: "PATCH",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({ action: "revoke" }),
			});

			if (!res.ok) {
				const body = await res.json().catch(() => ({}));
				toast({
					title: "Unable to revoke invite",
					description: body?.error ?? "Please try again.",
					variant: "destructive",
				});
				return;
			}

			setInvites((prev) => prev.filter((invite) => invite.id !== inviteId));
			toast({ title: "Invite revoked" });
		});
	};

	const handleResend = (inviteId: string) => {
		startTransition(async () => {
			const res = await fetch(`/api/households/invites/${inviteId}`, {
				method: "PATCH",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({ action: "resend" }),
			});

			if (!res.ok) {
				const body = await res.json().catch(() => ({}));
				toast({
					title: "Unable to resend invite",
					description: body?.error ?? "Please try again.",
					variant: "destructive",
				});
				return;
			}

			const body = await res.json().catch(() => ({}));
			if (body?.invite) {
				setInvites((prev) =>
					prev.map((invite) => (invite.id === body.invite.id ? { ...invite, ...body.invite } : invite)),
				);
			}
			toast({ title: "Invite regenerated" });
		});
	};

	const handleCopy = async (code: string) => {
		try {
			await navigator.clipboard.writeText(code);
			toast({ title: "Invite code copied" });
		} catch (error) {
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
