"use client";

import { ArrowRightIcon, LinkIcon } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { signIn } from "next-auth/react";
import { useTheme } from "next-themes";
import { useEffect, useState } from "react";

import { Button } from "@/components/ui/Button";
import { Card, CardDescription, CardHeader, CardTitle } from "@/components/ui/Card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/Select";
import { useToast } from "@/hooks/useToast";
import i18n from "@/lib/i18n";
import { useTranslation } from "@/lib/i18nClient";
import { DEFAULT_LANGUAGE, getLanguageLabel, normalizeLanguage, SUPPORTED_LANGUAGES } from "@/lib/i18nConfig";
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
	const { t } = useTranslation();
	const router = useRouter();
	const [language, setLanguage] = useState(normalizeLanguage(user.language ?? DEFAULT_LANGUAGE));

	const updateLanguage = trpc.profile.updateLanguage.useMutation({
		onMutate: (input) => {
			const previousLanguage = language;
			setLanguage(input.language);
			return { previousLanguage };
		},
		onSuccess: async (data) => {
			const normalizedLanguage = normalizeLanguage(data.language);
			setLanguage(normalizedLanguage);
			await i18n.changeLanguage(normalizedLanguage);
			const languageLabel = t(getLanguageLabel(data.language));
			toast({
				title: t("Language updated"),
				description: t("Language set to {{language}}.", { language: languageLabel }),
			});
			router.refresh();
		},
		onError: (error, _variables, context) => {
			if (context?.previousLanguage) {
				setLanguage(context.previousLanguage);
			}
			toast({
				title: t("Unable to update language"),
				description: error.message || t("Please try again."),
			});
		},
	});
	const getDisplayLanguage = (value: string) => t(getLanguageLabel(value));

	const handleLanguageChange = (value: string) => {
		const normalizedValue = normalizeLanguage(value);
		if (normalizedValue === language || updateLanguage.isPending) {
			return;
		}
		updateLanguage.mutate({ language: normalizedValue });
	};

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
			title: t("Google account linked"),
			description: t("Your profile has been updated."),
		});
	}, [googleEnabled, toast, t]);

	return (
		<div className="space-y-6">
			<Card>
				<CardHeader>
					<div className="flex items-center justify-between gap-4">
						<div className="space-y-1.5">
							<CardTitle>{t("Appearance")}</CardTitle>
							<CardDescription>{t("Customize how the app looks on your device.")}</CardDescription>
						</div>
						<Select value={theme} onValueChange={setTheme}>
							<SelectTrigger className="w-[130px]">
								<SelectValue placeholder={t("Theme")} />
							</SelectTrigger>
							<SelectContent>
								<SelectItem value="light">{t("Light")}</SelectItem>
								<SelectItem value="dark">{t("Dark")}</SelectItem>
								<SelectItem value="system">{t("System")}</SelectItem>
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
								<CardTitle>{t("Language")}</CardTitle>
								<CardDescription>{t("Set the language used across all households.")}</CardDescription>
							</div>
							<div className="flex items-center gap-2">
								<Select value={language} onValueChange={handleLanguageChange} disabled={updateLanguage.isPending}>
									<SelectTrigger className="w-[160px]">
										<SelectValue placeholder={DEFAULT_LANGUAGE} />
									</SelectTrigger>
									<SelectContent>
										{SUPPORTED_LANGUAGES.map((languageOption) => (
											<SelectItem key={languageOption} value={languageOption}>
												{getDisplayLanguage(languageOption)}
											</SelectItem>
										))}
									</SelectContent>
								</Select>
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
								<CardTitle>{t("Account Linking")}</CardTitle>
								<CardDescription>{t("Connect your account with external providers.")}</CardDescription>
							</div>
							{user.hasGoogleAccount ? (
								<div className="flex items-center gap-2 text-sm text-muted-foreground whitespace-nowrap">
									<LinkIcon className="h-4 w-4" />
									<span>{t("Linked")}</span>
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
									{t("Link Google")}
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
								<CardTitle>{t("Administration")}</CardTitle>
								<CardDescription>{t("Manage users and system settings.")}</CardDescription>
							</div>
							<Button asChild variant="outline">
								<Link href={`/${householdId}/admin`}>
									{t("Admin Panel")}
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
