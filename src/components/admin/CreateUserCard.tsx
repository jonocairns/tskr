"use client";

import { UserPlusIcon } from "lucide-react";
import { type FormEvent, useState } from "react";

import type { UserRow } from "@/components/admin/UsersTable";
import {
	AlertDialog,
	AlertDialogContent,
	AlertDialogDescription,
	AlertDialogFooter,
	AlertDialogHeader,
	AlertDialogTitle,
	AlertDialogTrigger,
} from "@/components/ui/AlertDialog";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Label } from "@/components/ui/Label";
import { Switch } from "@/components/ui/Switch";
import { useToast } from "@/hooks/useToast";
import { trpc } from "@/lib/trpc/react";

const MIN_PASSWORD_LENGTH = 8;

type Props = {
	onCreated?: (user: UserRow) => void;
};

export const CreateUserDialog = ({ onCreated }: Props) => {
	const { toast } = useToast();
	const [open, setOpen] = useState(false);
	const [name, setName] = useState("");
	const [email, setEmail] = useState("");
	const [password, setPassword] = useState("");
	const [confirmPassword, setConfirmPassword] = useState("");
	const [requireReset, setRequireReset] = useState(true);

	const resetForm = () => {
		setName("");
		setEmail("");
		setPassword("");
		setConfirmPassword("");
		setRequireReset(true);
	};

	const createMutation = trpc.admin.createUser.useMutation({
		onSuccess: (result) => {
			resetForm();
			setOpen(false);
			toast({ title: "User created" });

			if (result.user && onCreated) {
				onCreated(result.user);
			}
		},
		onError: (error) => {
			toast({
				title: "Create failed",
				description: error.message ?? "Please try again.",
				variant: "destructive",
			});
		},
	});

	const canSubmit =
		email.trim().length > 0 &&
		password.length >= MIN_PASSWORD_LENGTH &&
		confirmPassword.length >= MIN_PASSWORD_LENGTH &&
		password === confirmPassword;

	const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
		event.preventDefault();

		if (!email.trim()) {
			toast({
				title: "Email required",
				description: "Enter a valid email address.",
				variant: "destructive",
			});
			return;
		}

		if (password.length < MIN_PASSWORD_LENGTH) {
			toast({
				title: "Password too short",
				description: `Use at least ${MIN_PASSWORD_LENGTH} characters.`,
				variant: "destructive",
			});
			return;
		}

		if (password !== confirmPassword) {
			toast({
				title: "Passwords do not match",
				description: "Re-enter the same password to continue.",
				variant: "destructive",
			});
			return;
		}

		createMutation.mutate({
			name: name.trim().length > 0 ? name.trim() : null,
			email: email.trim(),
			password,
			passwordResetRequired: requireReset,
		});
	};

	const isPending = createMutation.isPending;

	const handleOpenChange = (nextOpen: boolean) => {
		if (!nextOpen) {
			resetForm();
		}
		setOpen(nextOpen);
	};

	return (
		<AlertDialog open={open} onOpenChange={handleOpenChange}>
			<AlertDialogTrigger asChild>
				<Button size="icon" variant="ghost" aria-label="Add user" className="h-9 w-9">
					<UserPlusIcon className="h-5 w-5" />
				</Button>
			</AlertDialogTrigger>
			<AlertDialogContent>
				<AlertDialogHeader>
					<AlertDialogTitle>Create user</AlertDialogTitle>
					<AlertDialogDescription>Create a password-based user account.</AlertDialogDescription>
				</AlertDialogHeader>
				<form className="space-y-4" onSubmit={handleSubmit}>
					<div className="grid gap-4 sm:grid-cols-2">
						<div className="space-y-2">
							<Label htmlFor="create-user-name">Name</Label>
							<Input
								id="create-user-name"
								value={name}
								onChange={(event) => setName(event.target.value)}
								disabled={isPending}
							/>
						</div>
						<div className="space-y-2">
							<Label htmlFor="create-user-email">Email</Label>
							<Input
								id="create-user-email"
								type="email"
								autoComplete="email"
								value={email}
								onChange={(event) => setEmail(event.target.value)}
								disabled={isPending}
							/>
						</div>
					</div>
					<div className="grid gap-4 sm:grid-cols-2">
						<div className="space-y-2">
							<Label htmlFor="create-user-password">Temporary password</Label>
							<Input
								id="create-user-password"
								type="password"
								autoComplete="new-password"
								value={password}
								onChange={(event) => setPassword(event.target.value)}
								disabled={isPending}
							/>
						</div>
						<div className="space-y-2">
							<Label htmlFor="create-user-confirm">Confirm password</Label>
							<Input
								id="create-user-confirm"
								type="password"
								autoComplete="new-password"
								value={confirmPassword}
								onChange={(event) => setConfirmPassword(event.target.value)}
								disabled={isPending}
							/>
						</div>
					</div>
					<div className="flex items-center justify-between rounded-md border p-3">
						<div>
							<p className="text-sm font-medium">Require reset on first login</p>
							<p className="text-xs text-muted-foreground">Forces the user to pick a new password after signing in.</p>
						</div>
						<Switch checked={requireReset} onCheckedChange={setRequireReset} disabled={isPending} />
					</div>
					<AlertDialogFooter>
						<Button type="button" variant="outline" onClick={() => setOpen(false)} disabled={isPending}>
							Cancel
						</Button>
						<Button type="submit" disabled={!canSubmit || isPending}>
							{isPending ? "Creating..." : "Create user"}
						</Button>
					</AlertDialogFooter>
				</form>
			</AlertDialogContent>
		</AlertDialog>
	);
};
