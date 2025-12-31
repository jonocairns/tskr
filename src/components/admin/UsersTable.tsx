"use client";

import { ChromeIcon, XIcon } from "lucide-react";
import type { Dispatch, SetStateAction } from "react";
import { useMemo, useState } from "react";
import {
	AlertDialog,
	AlertDialogContent,
	AlertDialogDescription,
	AlertDialogFooter,
	AlertDialogHeader,
	AlertDialogTitle,
} from "@/components/ui/AlertDialog";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Label } from "@/components/ui/Label";
import { Switch } from "@/components/ui/Switch";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/Table";
import { useToast } from "@/hooks/useToast";
import { trpc } from "@/lib/trpc/react";

export type UserRow = {
	id: string;
	name: string | null;
	email: string | null;
	createdAt: string;
	isSuperAdmin: boolean;
	passwordResetRequired: boolean;
	passwordLoginDisabled: boolean;
	hasGoogleAccount: boolean;
};

export type RowState = UserRow & {
	isSaving: boolean;
	isDeleting: boolean;
	isResetting: boolean;
	isClearingReset: boolean;
	resetUrl: string;
	resetExpiresAt: string;
};

type Draft = {
	id: string;
	name: string;
	email: string;
	passwordResetRequired: boolean;
	passwordLoginDisabled: boolean;
};

type Props = {
	rows: RowState[];
	setRows: Dispatch<SetStateAction<RowState[]>>;
	currentUserId?: string;
	googleEnabled: boolean;
};

export const UsersTable = ({ rows, setRows, currentUserId, googleEnabled }: Props) => {
	const { toast } = useToast();
	const [draft, setDraft] = useState<Draft | null>(null);

	const rowsById = useMemo(() => {
		const map = new Map<string, RowState>();
		for (const row of rows) {
			map.set(row.id, row);
		}
		return map;
	}, [rows]);

	const setRow = (id: string, updater: (row: RowState) => RowState) => {
		setRows((current) => current.map((row) => (row.id === id ? updater(row) : row)));
	};

	const openEditor = (row: RowState) => {
		setDraft({
			id: row.id,
			name: row.name ?? "",
			email: row.email ?? "",
			passwordResetRequired: row.passwordResetRequired,
			passwordLoginDisabled: row.passwordLoginDisabled,
		});
	};

	const closeEditor = () => {
		setDraft(null);
	};

	const updateUserMutation = trpc.admin.updateUser.useMutation({
		onMutate: ({ id }) => {
			setRow(id, (current) => ({ ...current, isSaving: true }));
		},
		onSuccess: (_, variables) => {
			const name = draft?.name.trim() ?? "";
			const email = draft?.email.trim().toLowerCase() ?? "";
			setRow(variables.id, (current) => ({
				...current,
				name: name.length > 0 ? name : null,
				email,
				passwordResetRequired: draft?.passwordResetRequired ?? current.passwordResetRequired,
				passwordLoginDisabled: draft?.passwordLoginDisabled ?? current.passwordLoginDisabled,
				isSaving: false,
			}));
			closeEditor();
			toast({ title: "User updated" });
		},
		onError: (error, variables) => {
			toast({
				title: "Update failed",
				description: error.message ?? "Please try again.",
				variant: "destructive",
			});
			setRow(variables.id, (current) => ({ ...current, isSaving: false }));
		},
	});

	const deleteUserMutation = trpc.admin.deleteUser.useMutation({
		onMutate: ({ id }) => {
			setRow(id, (current) => ({ ...current, isDeleting: true }));
		},
		onSuccess: (_, variables) => {
			setRows((current) => current.filter((item) => item.id !== variables.id));
			closeEditor();
			toast({ title: "User deleted" });
		},
		onError: (error, variables) => {
			toast({
				title: "Delete failed",
				description: error.message ?? "Please try again.",
				variant: "destructive",
			});
			setRow(variables.id, (current) => ({ ...current, isDeleting: false }));
		},
	});

	const createPasswordResetMutation = trpc.admin.createPasswordReset.useMutation({
		onMutate: ({ email }) => {
			const row = Array.from(rowsById.values()).find((r) => r.email?.toLowerCase() === email.toLowerCase());
			if (row) {
				setRow(row.id, (current) => ({ ...current, isResetting: true }));
			}
		},
		onSuccess: (result, variables) => {
			const row = Array.from(rowsById.values()).find((r) => r.email?.toLowerCase() === variables.email.toLowerCase());
			if (row) {
				setRow(row.id, (current) => ({
					...current,
					isResetting: false,
					resetUrl: result.resetUrl,
					resetExpiresAt: result.expiresAt,
				}));
			}
			toast({ title: "Reset link created" });
		},
		onError: (error, variables) => {
			const row = Array.from(rowsById.values()).find((r) => r.email?.toLowerCase() === variables.email.toLowerCase());
			if (row) {
				setRow(row.id, (current) => ({ ...current, isResetting: false }));
			}
			toast({
				title: "Reset link failed",
				description: error.message ?? "Please try again.",
				variant: "destructive",
			});
		},
	});

	const deletePasswordResetsMutation = trpc.admin.deletePasswordResets.useMutation({
		onMutate: ({ userId }) => {
			setRow(userId, (current) => ({ ...current, isClearingReset: true }));
		},
		onSuccess: (result, variables) => {
			setRow(variables.userId, (current) => ({
				...current,
				isClearingReset: false,
				resetUrl: "",
				resetExpiresAt: "",
			}));
			toast({
				title: result.deleted && result.deleted > 0 ? "Reset links deleted" : "No reset links found",
			});
		},
		onError: (error, variables) => {
			toast({
				title: "Unable to delete reset links",
				description: error.message ?? "Please try again.",
				variant: "destructive",
			});
			setRow(variables.userId, (current) => ({ ...current, isClearingReset: false }));
		},
	});

	const handleSave = () => {
		if (!draft) {
			return;
		}
		const row = rowsById.get(draft.id);
		if (!row) {
			return;
		}

		const name = draft.name.trim();
		const email = draft.email.trim().toLowerCase();
		if (!email) {
			toast({
				title: "Email required",
				description: "Enter a valid email address.",
				variant: "destructive",
			});
			return;
		}

		updateUserMutation.mutate({
			id: row.id,
			name: name.length > 0 ? name : null,
			email,
			passwordResetRequired: draft.passwordResetRequired,
			passwordLoginDisabled: draft.passwordLoginDisabled,
		});
	};

	const handleDelete = (id: string) => {
		const row = rowsById.get(id);
		if (!row) {
			return;
		}

		if (!window.confirm(`Delete ${row.email ?? "this user"}?`)) {
			return;
		}

		deleteUserMutation.mutate({ id });
	};

	const handleResetLink = (id: string, draftEmail?: string) => {
		const row = rowsById.get(id);
		if (!row) {
			return;
		}

		const savedEmail = row.email?.trim().toLowerCase() ?? "";
		const draftEmailNormalized = draftEmail?.trim().toLowerCase() ?? savedEmail;

		if (!savedEmail) {
			toast({
				title: "Email required",
				description: "Add an email before generating a reset link.",
				variant: "destructive",
			});
			return;
		}

		if (draftEmailNormalized !== savedEmail) {
			toast({
				title: "Save email first",
				description: "Save the new email before generating a reset link.",
				variant: "destructive",
			});
			return;
		}

		createPasswordResetMutation.mutate({ email: savedEmail });
	};

	const handleClearResetLinks = (id: string) => {
		const row = rowsById.get(id);
		if (!row) {
			return;
		}

		if (!window.confirm("Delete all reset links for this user?")) {
			return;
		}

		deletePasswordResetsMutation.mutate({ userId: id });
	};

	const handleCopy = async (url: string) => {
		try {
			await navigator.clipboard.writeText(url);
			toast({ title: "Link copied to clipboard" });
		} catch (_error) {
			toast({
				title: "Unable to copy",
				description: "Copy the link manually.",
				variant: "destructive",
			});
		}
	};

	const activeRow = draft ? (rowsById.get(draft.id) ?? null) : null;
	const editorOpen = Boolean(draft && activeRow);

	const savedName = (activeRow?.name ?? "").trim();
	const savedEmail = (activeRow?.email ?? "").trim().toLowerCase();
	const draftName = draft?.name.trim() ?? "";
	const draftEmail = draft?.email.trim().toLowerCase() ?? "";
	const nameDirty = Boolean(activeRow && draftName !== savedName);
	const emailDirty = Boolean(activeRow && draftEmail !== savedEmail);
	const resetRequiredDirty = Boolean(activeRow && draft?.passwordResetRequired !== activeRow.passwordResetRequired);
	const passwordLoginDirty = Boolean(activeRow && draft?.passwordLoginDisabled !== activeRow.passwordLoginDisabled);
	const hasChanges = nameDirty || emailDirty || resetRequiredDirty || passwordLoginDirty;
	const isPending =
		updateUserMutation.isPending ||
		deleteUserMutation.isPending ||
		createPasswordResetMutation.isPending ||
		deletePasswordResetsMutation.isPending;
	const isBusy =
		(activeRow?.isSaving ?? false) ||
		(activeRow?.isDeleting ?? false) ||
		(activeRow?.isResetting ?? false) ||
		(activeRow?.isClearingReset ?? false) ||
		isPending;
	const allowPassword = draft ? !draft.passwordLoginDisabled : true;
	const canDisablePassword = googleEnabled && (activeRow?.hasGoogleAccount ?? false);
	const passwordToggleDisabled = isBusy || (!canDisablePassword && allowPassword);
	const canSave = Boolean(draft && hasChanges && draftEmail.length > 0 && !isBusy);
	const columnCount = googleEnabled ? 8 : 7;

	if (rows.length === 0) {
		return (
			<Table>
				<TableHeader>
					<TableRow>
						<TableHead>Name</TableHead>
						<TableHead>Email</TableHead>
						<TableHead>Role</TableHead>
						<TableHead>Reset required</TableHead>
						<TableHead>Created</TableHead>
						{googleEnabled ? <TableHead className="text-center">Google linked</TableHead> : null}
						<TableHead>Password login</TableHead>
						<TableHead>Actions</TableHead>
					</TableRow>
				</TableHeader>
				<TableBody>
					<TableRow>
						<TableCell colSpan={columnCount} className="text-center">
							No users yet.
						</TableCell>
					</TableRow>
				</TableBody>
			</Table>
		);
	}

	return (
		<>
			<Table>
				<TableHeader>
					<TableRow>
						<TableHead>Name</TableHead>
						<TableHead>Email</TableHead>
						<TableHead>Role</TableHead>
						<TableHead>Reset required</TableHead>
						<TableHead>Created</TableHead>
						{googleEnabled ? <TableHead className="text-center">Google linked</TableHead> : null}
						<TableHead>Password login</TableHead>
						<TableHead>Actions</TableHead>
					</TableRow>
				</TableHeader>
				<TableBody>
					{rows.map((row) => {
						const createdLabel = new Date(row.createdAt).toLocaleDateString();
						const isSelf = currentUserId === row.id;

						return (
							<TableRow key={row.id}>
								<TableCell>{row.name ?? "—"}</TableCell>
								<TableCell>{row.email ?? "—"}</TableCell>
								<TableCell>{row.isSuperAdmin ? "Super admin" : "User"}</TableCell>
								<TableCell>{row.passwordResetRequired ? "Yes" : "No"}</TableCell>
								<TableCell>{createdLabel}</TableCell>
								{googleEnabled ? (
									<TableCell className="text-center">
										{row.hasGoogleAccount ? (
											<>
												<ChromeIcon className="inline h-4 w-4 text-emerald-500" />
												<span className="sr-only">Google linked</span>
											</>
										) : (
											<>
												<XIcon className="inline h-4 w-4 text-muted-foreground" />
												<span className="sr-only">Not linked</span>
											</>
										)}
									</TableCell>
								) : null}
								<TableCell>{row.passwordLoginDisabled ? "Disabled" : "Allowed"}</TableCell>
								<TableCell>
									<Button type="button" size="sm" variant="outline" onClick={() => openEditor(row)}>
										Edit
									</Button>
									{isSelf ? <span className="sr-only">You</span> : null}
								</TableCell>
							</TableRow>
						);
					})}
				</TableBody>
			</Table>

			<AlertDialog open={editorOpen} onOpenChange={(open) => (!open ? closeEditor() : null)}>
				<AlertDialogContent>
					<AlertDialogHeader>
						<div className="flex items-center justify-between gap-4">
							<AlertDialogTitle>Edit user</AlertDialogTitle>
							{googleEnabled && activeRow?.hasGoogleAccount ? (
								<ChromeIcon className="h-5 w-5 text-emerald-500" />
							) : null}
						</div>
						<AlertDialogDescription>
							Update profile details, login methods, or generate a reset link.
						</AlertDialogDescription>
					</AlertDialogHeader>
					{draft && activeRow ? (
						<div className="space-y-4">
							<div className="grid gap-4 sm:grid-cols-2">
								<div className="space-y-2">
									<Label htmlFor="admin-user-name">Name</Label>
									<Input
										id="admin-user-name"
										value={draft.name}
										onChange={(event) =>
											setDraft((current) => (current ? { ...current, name: event.target.value } : current))
										}
										disabled={isBusy}
									/>
								</div>
								<div className="space-y-2">
									<Label htmlFor="admin-user-email">Email</Label>
									<Input
										id="admin-user-email"
										type="email"
										value={draft.email}
										onChange={(event) =>
											setDraft((current) => (current ? { ...current, email: event.target.value } : current))
										}
										disabled={isBusy}
									/>
								</div>
							</div>

							<div className="space-y-3">
								<div className="flex items-center justify-between rounded-md border p-3">
									<div>
										<p className="text-sm font-medium">Password login</p>
										<p className="text-xs text-muted-foreground">Allow email/password login</p>
									</div>
									<Switch
										checked={allowPassword}
										onCheckedChange={(checked) =>
											setDraft((current) =>
												current
													? {
															...current,
															passwordLoginDisabled: !checked,
														}
													: current,
											)
										}
										disabled={passwordToggleDisabled}
									/>
								</div>
								<div className="flex items-center justify-between rounded-md border p-3">
									<div>
										<p className="text-sm font-medium">Reset required</p>
										<p className="text-xs text-muted-foreground">Require a password reset on their next login.</p>
									</div>
									<Switch
										checked={draft.passwordResetRequired}
										onCheckedChange={(checked) =>
											setDraft((current) =>
												current
													? {
															...current,
															passwordResetRequired: checked,
														}
													: current,
											)
										}
										disabled={isBusy || draft.passwordLoginDisabled}
									/>
								</div>
							</div>

							<div className="space-y-2">
								<div className="flex flex-wrap items-center gap-2">
									<Button
										type="button"
										variant="outline"
										size="sm"
										onClick={() => handleResetLink(activeRow.id, draft.email)}
										disabled={isBusy || activeRow.isResetting || draft.passwordLoginDisabled}
									>
										{activeRow.isResetting ? "Generating reset link..." : "Generate password reset link"}
									</Button>
									{activeRow.resetUrl ? (
										<Button type="button" variant="secondary" size="sm" onClick={() => handleCopy(activeRow.resetUrl)}>
											Copy
										</Button>
									) : null}
									<Button
										type="button"
										variant="ghost"
										size="sm"
										onClick={() => handleClearResetLinks(activeRow.id)}
										disabled={isBusy || activeRow.isClearingReset}
									>
										{activeRow.isClearingReset ? "Deleting links..." : "Delete reset links"}
									</Button>
								</div>
								{activeRow.resetUrl ? <Input value={activeRow.resetUrl} readOnly className="text-xs" /> : null}
								{activeRow.resetExpiresAt ? (
									<div className="text-xs text-muted-foreground">
										Reset link expires {new Date(activeRow.resetExpiresAt).toLocaleString()}
									</div>
								) : null}
							</div>

							<div className="flex flex-wrap items-center justify-between gap-2 rounded-md border border-destructive/30 bg-destructive/5 p-3">
								<div>
									<p className="text-sm font-medium text-destructive">Delete user</p>
									<p className="text-xs text-muted-foreground">This removes the user and their memberships.</p>
								</div>
								<Button
									type="button"
									variant="destructive"
									size="sm"
									onClick={() => handleDelete(activeRow.id)}
									disabled={isBusy || currentUserId === activeRow.id}
								>
									{activeRow.isDeleting ? "Deleting..." : "Delete"}
								</Button>
							</div>
						</div>
					) : null}
					<AlertDialogFooter>
						<Button type="button" variant="outline" onClick={closeEditor} disabled={isBusy}>
							Cancel
						</Button>
						<Button type="button" onClick={handleSave} disabled={!canSave}>
							{activeRow?.isSaving ? "Saving..." : "Save changes"}
						</Button>
					</AlertDialogFooter>
				</AlertDialogContent>
			</AlertDialog>
		</>
	);
};
