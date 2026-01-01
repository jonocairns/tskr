"use client";

import { useState } from "react";

import { Card, CardDescription, CardHeader, CardTitle } from "@/components/ui/Card";
import { Switch } from "@/components/ui/Switch";
import { useToast } from "@/hooks/useToast";
import { trpc } from "@/lib/trpc/react";

type Props = {
	initialAllowGoogleAccountCreation: boolean;
};

export const AuthSettingsCard = ({ initialAllowGoogleAccountCreation }: Props) => {
	const { toast } = useToast();
	const [allowGoogleAccountCreation, setAllowGoogleAccountCreation] = useState(initialAllowGoogleAccountCreation);

	const { mutate: updateSettings, isPending } = trpc.admin.updateAppSettings.useMutation({
		onSuccess: (result) => {
			setAllowGoogleAccountCreation(result.settings.allowGoogleAccountCreation);
			toast({ title: "Settings updated" });
		},
		onError: (error, variables) => {
			setAllowGoogleAccountCreation(!variables.allowGoogleAccountCreation);
			toast({
				title: "Update failed",
				description: error.message ?? "Please try again.",
				variant: "destructive",
			});
		},
	});

	const handleToggle = (value: boolean) => {
		setAllowGoogleAccountCreation(value);
		updateSettings({ allowGoogleAccountCreation: value });
	};

	return (
		<Card>
			<CardHeader>
				<div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
					<div className="space-y-1">
						<CardTitle>Allow new Google accounts?</CardTitle>
						<CardDescription>
							When disabled, only users with an existing Google linked account or email/password can sign in.
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
