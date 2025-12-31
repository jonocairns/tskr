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

	const createMutation = trpc.households.create.useMutation({
		onSuccess: async () => {
			setName("");
			toast({ title: "Household created" });
			await update();
			if (redirectTo) {
				router.push(redirectTo);
			} else {
				router.refresh();
			}
		},
		onError: (error) => {
			toast({
				title: "Unable to create household",
				description: error.message ?? "Please try again.",
				variant: "destructive",
			});
		},
	});

	const handleCreate = () => {
		if (!canSubmit) {
			return;
		}

		startTransition(async () => {
			await createMutation.mutateAsync({
				name: trimmed.length > 0 ? trimmed : undefined,
			});
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
