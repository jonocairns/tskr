"use client";

import { ArrowRightIcon, LinkIcon } from "lucide-react";
import Link from "next/link";
import { signIn } from "next-auth/react";
import { useTheme } from "next-themes";
import { useEffect, useState } from "react";

import { Button } from "@/components/ui/Button";
import { Card, CardDescription, CardHeader, CardTitle } from "@/components/ui/Card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/Select";
import { useToast } from "@/hooks/useToast";
import i18n from "@/lib/i18n";
import { DEFAULT_LANGUAGE, SUPPORTED_LANGUAGES } from "@/lib/i18nConfig";
import { trpc } from "@/lib/trpc/react";

type Props = {
	user: {
		name?: string | null;
		email?: string | null;
		hasGoogleAccount?: boolean;
		isSuperAdmin?: boolean;
		language?: string | null;
	};
	googleEnabled: boolean;
	householdId: string;
};

export const SettingsContent = ({ user, googleEnabled, householdId }: Props) => {
	const { theme, setTheme } = useTheme();
	const { toast } = useToast();
	const [language, setLanguage] = useState(user.language ?? DEFAULT_LANGUAGE);

	const updateLanguage = trpc.profile.updateLanguage.useMutation({
		onSuccess: async (data) => {
			setLanguage(data.language);
			await i18n.changeLanguage(data.language);
			toast({
				title: "Language updated",
				description: `Language set to ${data.language}.`,
			});
		},
		onError: (error) => {
			toast({
				title: "Unable to update language",
				description: error.message || "Please try again.",
			});
		},
	});

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

			{SUPPORTED_LANGUAGES.length > 1 ? (
				<Card>
					<CardHeader>
						<div className="flex items-center justify-between gap-4">
							<div className="space-y-1.5">
								<CardTitle>Language</CardTitle>
								<CardDescription>Set the language used across all households.</CardDescription>
							</div>
							<div className="flex items-center gap-2">
								<Select value={language} onValueChange={setLanguage}>
									<SelectTrigger className="w-[160px]">
										<SelectValue placeholder={DEFAULT_LANGUAGE} />
									</SelectTrigger>
									<SelectContent>
										{SUPPORTED_LANGUAGES.map((languageOption) => (
											<SelectItem key={languageOption} value={languageOption}>
												{languageOption}
											</SelectItem>
										))}
									</SelectContent>
								</Select>
								<Button
									onClick={() => updateLanguage.mutate({ language })}
									disabled={updateLanguage.isPending || language === (user.language ?? DEFAULT_LANGUAGE)}
									variant="outline"
								>
									{updateLanguage.isPending ? "Saving..." : "Save"}
								</Button>
							</div>
						</div>
					</CardHeader>
				</Card>
			) : null}

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
