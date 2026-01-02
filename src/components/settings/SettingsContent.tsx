"use client";

import { ArrowRightIcon, LinkIcon } from "lucide-react";
import Link from "next/link";
import { signIn } from "next-auth/react";
import { useTheme } from "next-themes";
import { useEffect } from "react";

import { Button } from "@/components/ui/Button";
import { Card, CardDescription, CardHeader, CardTitle } from "@/components/ui/Card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/Select";
import { useToast } from "@/hooks/useToast";

type Props = {
	user: {
		name?: string | null;
		email?: string | null;
		hasGoogleAccount?: boolean;
		isSuperAdmin?: boolean;
	};
	googleEnabled: boolean;
	householdId: string;
};

export const SettingsContent = ({ user, googleEnabled, householdId }: Props) => {
	const { theme, setTheme } = useTheme();
	const { toast } = useToast();

	useEffect(() => {
		if (!googleEnabled) {
			return;
		}
		if (typeof window === "undefined") {
			return;
		}
		const flag = window.sessionStorage.getItem("googleLinkSuccess");
		if (!flag) {
			return;
		}
		window.sessionStorage.removeItem("googleLinkSuccess");
		toast({
			title: "Google account linked",
			description: "Your profile has been updated.",
		});
	}, [googleEnabled, toast]);

	return (
		<div className="space-y-6">
			<Card>
				<CardHeader>
					<div className="flex items-center justify-between gap-4">
						<div className="space-y-1.5">
							<CardTitle>Appearance</CardTitle>
							<CardDescription>Customize how the app looks on your device.</CardDescription>
						</div>
						<Select value={theme} onValueChange={setTheme}>
							<SelectTrigger className="w-[130px]">
								<SelectValue placeholder="Theme" />
							</SelectTrigger>
							<SelectContent>
								<SelectItem value="light">Light</SelectItem>
								<SelectItem value="dark">Dark</SelectItem>
								<SelectItem value="system">System</SelectItem>
							</SelectContent>
						</Select>
					</div>
				</CardHeader>
			</Card>

			{googleEnabled ? (
				<Card>
					<CardHeader>
						<div className="flex items-center justify-between gap-4">
							<div className="space-y-1.5">
								<CardTitle>Account Linking</CardTitle>
								<CardDescription>Connect your account with external providers.</CardDescription>
							</div>
							{user.hasGoogleAccount ? (
								<div className="flex items-center gap-2 text-sm text-muted-foreground whitespace-nowrap">
									<LinkIcon className="h-4 w-4" />
									<span>Linked</span>
								</div>
							) : (
								<Button
									onClick={() => {
										const returnTo = window.location.pathname + window.location.search + window.location.hash;
										signIn("google", {
											callbackUrl: `/auth/link?returnTo=${encodeURIComponent(returnTo)}`,
										});
									}}
								>
									<LinkIcon className="mr-2 h-4 w-4" />
									Link Google
								</Button>
							)}
						</div>
					</CardHeader>
				</Card>
			) : null}

			{user.isSuperAdmin ? (
				<Card>
					<CardHeader>
						<div className="flex items-center justify-between gap-4">
							<div className="space-y-1.5">
								<CardTitle>Administration</CardTitle>
								<CardDescription>Manage users and system settings.</CardDescription>
							</div>
							<Button asChild variant="outline">
								<Link href={`/${householdId}/admin`}>
									Admin Panel
									<ArrowRightIcon className="ml-2 h-4 w-4" />
								</Link>
							</Button>
						</div>
					</CardHeader>
				</Card>
			) : null}
		</div>
	);
};
