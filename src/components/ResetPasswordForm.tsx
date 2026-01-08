"use client";

import { useRouter } from "@tanstack/react-router";
import { type FormEvent, useState, useTransition } from "react";

import { signIn } from "@/auth/client";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Label } from "@/components/ui/Label";
import { useToast } from "@/hooks/useToast";
import { trpc } from "@/lib/trpc/react";

type Props = {
	token: string;
};

export const ResetPasswordForm = ({ token }: Props) => {
	const [password, setPassword] = useState("");
	const [confirmPassword, setConfirmPassword] = useState("");
	const [isPending, startTransition] = useTransition();
	const { toast } = useToast();
	const router = useRouter();

	const canSubmit = password.length >= 8 && confirmPassword.length >= 8 && password === confirmPassword;

	const resetMutation = trpc.passwordReset.reset.useMutation({
		onSuccess: async (data) => {
			if (!data.email) {
				toast({ title: "Password updated" });
				router.navigate({ to: "/", search: { error: undefined } });
				router.invalidate();
				return;
			}

			toast({ title: "Password updated", description: "Signing you in..." });

			try {
				const result = await signIn.email({
					email: data.email,
					password,
				});

				// Better Auth returns { data, error } - check if we got valid data
				if (result.error || !result.data) {
					console.warn("[ResetPasswordForm] Sign-in returned error:", result.error);
					// Still navigate - the user can sign in manually
					toast({ title: "Password updated", description: "Please sign in with your new password." });
					router.navigate({ to: "/", search: { error: undefined } });
					router.invalidate();
					return;
				}

				toast({ title: "Password updated", description: "You're now signed in." });
				router.invalidate();
				router.navigate({ to: "/", search: { error: undefined } });
			} catch (error) {
				console.error("[ResetPasswordForm] Sign-in error:", error);
				// Password was reset successfully, just redirect to sign in
				toast({ title: "Password updated", description: "Please sign in with your new password." });
				router.navigate({ to: "/", search: { error: undefined } });
				router.invalidate();
			}
		},
		onError: (error) => {
			toast({
				title: "Unable to reset password",
				description: error.message ?? "Please request a new link.",
				variant: "destructive",
			});
		},
	});

	const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
		event.preventDefault();

		if (password.length < 8) {
			toast({
				title: "Password too short",
				description: "Use at least 8 characters.",
				variant: "destructive",
			});
			return;
		}
		if (password !== confirmPassword) {
			toast({
				title: "Passwords do not match",
				description: "Please re-enter the same password.",
				variant: "destructive",
			});
			return;
		}

		startTransition(async () => {
			await resetMutation.mutateAsync({ token, password });
		});
	};

	return (
		<form className="space-y-4" onSubmit={handleSubmit}>
			<div className="space-y-2">
				<Label htmlFor="new-password">New password</Label>
				<Input
					id="new-password"
					type="password"
					autoComplete="new-password"
					value={password}
					onChange={(event) => setPassword(event.target.value)}
					disabled={isPending}
				/>
			</div>
			<div className="space-y-2">
				<Label htmlFor="confirm-password">Confirm password</Label>
				<Input
					id="confirm-password"
					type="password"
					autoComplete="new-password"
					value={confirmPassword}
					onChange={(event) => setConfirmPassword(event.target.value)}
					disabled={isPending}
				/>
			</div>
			<Button type="submit" disabled={isPending || !canSubmit}>
				Set password
			</Button>
		</form>
	);
};
