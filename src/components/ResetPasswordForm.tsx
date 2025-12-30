"use client";

import { useRouter } from "next/navigation";
import { signIn } from "next-auth/react";
import { type FormEvent, useState, useTransition } from "react";

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
				router.push("/");
				router.refresh();
				return;
			}

			toast({ title: "Password updated", description: "Signing you in..." });

			const result = await signIn("credentials", {
				email: data.email,
				password,
				redirect: false,
			});

			if (result?.error) {
				toast({
					title: "Unable to sign in",
					description: "Try signing in manually.",
					variant: "destructive",
				});
				router.push("/");
				return;
			}

			router.push("/");
			router.refresh();
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
