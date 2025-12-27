"use client";

import { useState, useTransition } from "react";

import {
	Card,
	CardContent,
	CardDescription,
	CardHeader,
	CardTitle,
} from "@/components/ui/Card";
import { Label } from "@/components/ui/Label";
import { Switch } from "@/components/ui/Switch";
import { useToast } from "@/hooks/use-toast";

type Props = {
	initialAllowGoogleAccountCreation: boolean;
};

export const AuthSettingsCard = ({
	initialAllowGoogleAccountCreation,
}: Props) => {
	const { toast } = useToast();
	const [isPending, startTransition] = useTransition();
	const [allowGoogleAccountCreation, setAllowGoogleAccountCreation] = useState(
		initialAllowGoogleAccountCreation,
	);

	const handleToggle = (value: boolean) => {
		const previousValue = allowGoogleAccountCreation;
		setAllowGoogleAccountCreation(value);

		startTransition(async () => {
			const res = await fetch("/api/admin/app-settings", {
				method: "PATCH",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({ allowGoogleAccountCreation: value }),
			});

			if (!res.ok) {
				const body = await res.json().catch(() => ({}));
				setAllowGoogleAccountCreation(previousValue);
				toast({
					title: "Update failed",
					description: body?.error ?? "Please try again.",
					variant: "destructive",
				});
				return;
			}

			const body = await res.json().catch(() => ({}));
			if (typeof body?.settings?.allowGoogleAccountCreation === "boolean") {
				setAllowGoogleAccountCreation(body.settings.allowGoogleAccountCreation);
			}
			toast({ title: "Settings updated" });
		});
	};

	return (
		<Card>
			<CardHeader>
				<div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
					<div className="space-y-1">
						<CardTitle>Allow new Google accounts?</CardTitle>
						<CardDescription>
							When disabled, only users with an existing Google linked account
							or email/password can sign in.
						</CardDescription>
					</div>
					<Switch
						id="google-account-creation"
						checked={allowGoogleAccountCreation}
						onCheckedChange={handleToggle}
						disabled={isPending}
					/>
				</div>
			</CardHeader>
		</Card>
	);
};
