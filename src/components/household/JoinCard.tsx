"use client";

import { useRouter } from "next/navigation";
import { useSession } from "next-auth/react";
import { useState, useTransition } from "react";

import { Button } from "@/components/ui/Button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/Card";
import { Input } from "@/components/ui/Input";
import { Label } from "@/components/ui/Label";
import { useToast } from "@/hooks/useToast";
import { trpc } from "@/lib/trpc/react";

type Props = {
	variant?: "card" | "section";
};

export const JoinCard = ({ variant = "card" }: Props) => {
	const [code, setCode] = useState("");
	const [isPending, startTransition] = useTransition();
	const { toast } = useToast();
	const router = useRouter();
	const { update } = useSession();
	const isSection = variant === "section";

	const trimmed = code.trim().toUpperCase();
	const canSubmit = trimmed.length >= 4;

	const joinMutation = trpc.households.join.useMutation({
		onSuccess: async () => {
			setCode("");
			toast({ title: "Joined household" });

			// Update session - it will include the new householdId
			const session = await update();

			// Navigate to the new household
			if (session?.user?.householdId) {
				router.push(`/${session.user.householdId}`);
			} else {
				// Fallback to root which will redirect appropriately
				router.push("/");
			}
		},
		onError: (error) => {
			toast({
				title: "Unable to join household",
				description: error.message ?? "Please try again.",
				variant: "destructive",
			});
		},
	});

	const handleJoin = () => {
		if (!canSubmit) {
			return;
		}

		startTransition(async () => {
			await joinMutation.mutateAsync({ code: trimmed });
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
