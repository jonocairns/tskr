"use client";

import { RocketIcon } from "lucide-react";
import { signIn } from "next-auth/react";

import { Button } from "@/components/ui/Button";

export const AuthCta = () => {
	return (
		<div className="mx-auto flex max-w-2xl flex-col items-center gap-6 rounded-2xl border bg-card/50 p-10 text-center shadow-sm">
			<div className="flex h-12 w-12 items-center justify-center rounded-full bg-primary/10 text-primary">
				<RocketIcon className="h-6 w-6" />
			</div>
			<div className="space-y-2">
				<h1 className="text-3xl font-semibold tracking-tight">
					Track chores, claim rewards.
				</h1>
				<p className="text-muted-foreground">
					Sign in with Google to start logging tasks, watch your points climb,
					and keep an audit trail you can always undo.
				</p>
			</div>
			<Button size="lg" onClick={() => signIn("google")}>
				Sign in with Google
			</Button>
		</div>
	);
};
