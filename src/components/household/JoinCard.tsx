"use client";

import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";

import { Button } from "@/components/ui/Button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/Card";
import { Input } from "@/components/ui/Input";
import { Label } from "@/components/ui/Label";
import { useToast } from "@/hooks/use-toast";
import { requestJson } from "@/lib/request-json";

type Props = {
	variant?: "card" | "section";
	redirectTo?: string;
};

export const JoinCard = ({ variant = "card", redirectTo }: Props) => {
	const [code, setCode] = useState("");
	const [isPending, startTransition] = useTransition();
	const { toast } = useToast();
	const router = useRouter();
	const { update } = useSession();
	const isSection = variant === "section";

	const trimmed = code.trim().toUpperCase();
	const canSubmit = trimmed.length >= 4;

	const handleJoin = () => {
		if (!canSubmit) {
			return;
		}

		startTransition(async () => {
			const { res, data } = await requestJson<{ error?: string }>("/api/households/join", {
				method: "POST",
				body: { code: trimmed },
			});

			if (!res.ok) {
				toast({
					title: "Unable to join household",
					description: data?.error ?? "Please try again.",
					variant: "destructive",
				});
				return;
			}

			setCode("");
			toast({ title: "Joined household" });
			await update();
			if (redirectTo) {
				router.push(redirectTo);
			} else {
				router.refresh();
			}
		});
	};

	const header = (
		<div className={isSection ? "space-y-1" : undefined}>
			<CardTitle className={isSection ? "text-base" : "text-xl"}>Join another household</CardTitle>
			<CardDescription>Enter a shareable invite code.</CardDescription>
		</div>
	);

	const content = (
		<div className="space-y-3">
			<div className="space-y-2">
				<Label htmlFor="invite-code">Invite code</Label>
				<Input
					id="invite-code"
					value={code}
					onChange={(event) => setCode(event.target.value)}
					placeholder="Enter code"
					disabled={isPending}
				/>
			</div>
			<Button type="button" onClick={handleJoin} disabled={!canSubmit || isPending}>
				Join household
			</Button>
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
