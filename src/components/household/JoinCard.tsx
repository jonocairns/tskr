"use client";

import { useRouter } from "next/navigation";
import { useSession } from "next-auth/react";
import { useState, useTransition } from "react";

import { Button } from "@/components/ui/Button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/Card";
import { Input } from "@/components/ui/Input";
import { Label } from "@/components/ui/Label";
import { useToast } from "@/hooks/useToast";
import { useTranslation } from "@/lib/i18nClient";
import { trpc } from "@/lib/trpc/react";

type Props = {
	variant?: "card" | "section";
};

export const JoinCard = ({ variant = "card" }: Props) => {
	const [code, setCode] = useState("");
	const [isPending, startTransition] = useTransition();
	const { toast } = useToast();
	const { t } = useTranslation();
	const router = useRouter();
	const { update } = useSession();
	const isSection = variant === "section";

	const trimmed = code.trim().toUpperCase();
	const canSubmit = trimmed.length >= 4;

	const joinMutation = trpc.households.join.useMutation({
		onSuccess: async (data) => {
			setCode("");
			toast({ title: t("Joined household") });
			await update();
			router.push(`/${data.householdId}`);
		},
		onError: (error) => {
			toast({
				title: t("Unable to join household"),
				description: error.message ?? t("Please try again."),
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
			<CardTitle className={isSection ? "text-base" : "text-xl"}>{t("Join another household")}</CardTitle>
			<CardDescription>{t("Enter a shareable invite code.")}</CardDescription>
		</div>
	);

	const content = (
		<div className="space-y-3">
			<div className="space-y-2">
				<Label htmlFor="invite-code">{t("Invite code")}</Label>
				<Input
					id="invite-code"
					value={code}
					onChange={(event) => setCode(event.target.value)}
					placeholder={t("Enter code")}
					disabled={isPending}
				/>
			</div>
			<Button type="button" onClick={handleJoin} disabled={!canSubmit || isPending}>
				{t("Join household")}
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
