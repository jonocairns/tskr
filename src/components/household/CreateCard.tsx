"use client";

import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";

import { Button } from "@/components/ui/Button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/Card";
import { Input } from "@/components/ui/Input";
import { Label } from "@/components/ui/Label";
import { useToast } from "@/hooks/use-toast";

type Props = {
	redirectTo?: string;
};

export const CreateCard = ({ redirectTo }: Props) => {
	const [name, setName] = useState("");
	const [isPending, startTransition] = useTransition();
	const { toast } = useToast();
	const router = useRouter();
	const { update } = useSession();

	const trimmed = name.trim();
	const canSubmit = trimmed.length === 0 || trimmed.length >= 2;

	const handleCreate = () => {
		if (!canSubmit) {
			return;
		}

		startTransition(async () => {
			const res = await fetch("/api/households", {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({
					name: trimmed.length > 0 ? trimmed : undefined,
				}),
			});

			if (!res.ok) {
				const body = await res.json().catch(() => ({}));
				toast({
					title: "Unable to create household",
					description: body?.error ?? "Please try again.",
					variant: "destructive",
				});
				return;
			}

			setName("");
			toast({ title: "Household created" });
			await update();
			if (redirectTo) {
				router.push(redirectTo);
			} else {
				router.refresh();
			}
		});
	};

	return (
		<Card>
			<CardHeader>
				<CardTitle className="text-xl">Create a household</CardTitle>
				<CardDescription>Start a new household from scratch.</CardDescription>
			</CardHeader>
			<CardContent className="space-y-3">
				<div className="space-y-2">
					<Label htmlFor="household-name">Name (optional)</Label>
					<Input
						id="household-name"
						value={name}
						onChange={(event) => setName(event.target.value)}
						placeholder="e.g. The Johnsons"
						disabled={isPending}
					/>
				</div>
				<Button type="button" onClick={handleCreate} disabled={!canSubmit || isPending}>
					Create household
				</Button>
			</CardContent>
		</Card>
	);
};
