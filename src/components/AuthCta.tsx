"use client";

import { RocketIcon } from "lucide-react";
import { signIn } from "next-auth/react";
import { useRouter } from "next/navigation";
import { useState, useTransition, type FormEvent } from "react";

import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Label } from "@/components/ui/Label";
import { Separator } from "@/components/ui/Separator";
import { useToast } from "@/hooks/use-toast";

export const AuthCta = () => {
	const [email, setEmail] = useState("");
	const [password, setPassword] = useState("");
	const [isPending, startTransition] = useTransition();
	const { toast } = useToast();
	const router = useRouter();

	const handleEmailSignIn = (event: FormEvent<HTMLFormElement>) => {
		event.preventDefault();
		const trimmedEmail = email.trim();
		if (!trimmedEmail || !password) {
			toast({
				title: "Missing credentials",
				description: "Enter your email and password.",
				variant: "destructive",
			});
			return;
		}

		startTransition(async () => {
			try {
				const result = await signIn("credentials", {
					email: trimmedEmail,
					password,
					redirect: false,
				});

				if (!result || result.error || result.ok === false) {
					toast({
						title: "Sign in failed",
						description: "Check your email or password.",
						variant: "destructive",
					});
					return;
				}

				if (result.url) {
					let target = result.url;
					if (result.url.startsWith("http")) {
						try {
							const parsed = new URL(result.url);
							target = parsed.pathname + parsed.search + parsed.hash;
						} catch {
							target = "/";
						}
					}
					const current =
						window.location.pathname +
						window.location.search +
						window.location.hash;
					if (target === current) {
						router.refresh();
						return;
					}
					router.push(target);
					router.refresh();
					return;
				}

				router.refresh();
			} catch (error) {
				toast({
					title: "Unable to sign in",
					description: "Please try again.",
					variant: "destructive",
				});
			}
		});
	};

	return (
		<div className="mx-auto flex w-full max-w-2xl flex-col items-center gap-6 rounded-2xl border bg-card/50 p-10 text-center shadow-sm">
			<div className="flex h-12 w-12 items-center justify-center rounded-full bg-primary/10 text-primary">
				<RocketIcon className="h-6 w-6" />
			</div>
			<div className="space-y-2">
				<h1 className="text-3xl font-semibold tracking-tight">
					Track tasks, claim rewards.
				</h1>
				<p className="text-muted-foreground">
					Sign in with Google or email to log tasks, watch your points climb,
					and keep an audit trail you can always undo.
				</p>
			</div>
			<div className="flex w-full flex-col gap-4">
				<Button size="lg" onClick={() => signIn("google")} disabled={isPending}>
					Sign in with Google
				</Button>
				<div className="flex items-center gap-3 text-xs uppercase tracking-[0.2em] text-muted-foreground">
					<Separator className="flex-1" />
					<span>or use email</span>
					<Separator className="flex-1" />
				</div>
				<form className="space-y-3" onSubmit={handleEmailSignIn}>
					<div className="space-y-2 text-left">
						<Label htmlFor="email-login">Email</Label>
						<Input
							id="email-login"
							type="email"
							autoComplete="email"
							value={email}
							onChange={(event) => setEmail(event.target.value)}
							disabled={isPending}
						/>
					</div>
					<div className="space-y-2 text-left">
						<Label htmlFor="password-login">Password</Label>
						<Input
							id="password-login"
							type="password"
							autoComplete="current-password"
							value={password}
							onChange={(event) => setPassword(event.target.value)}
							disabled={isPending}
						/>
					</div>
					<Button type="submit" size="lg" disabled={isPending}>
						Sign in with email
					</Button>
				</form>
			</div>
		</div>
	);
};
