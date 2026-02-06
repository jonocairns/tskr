"use client";

import type { Session } from "next-auth";
import { SessionProvider } from "next-auth/react";
import { useEffect } from "react";
import { PageTransition } from "@/components/PageTransition";
import { PullToRefresh } from "@/components/PullToRefresh";
import { ThemeProvider } from "@/components/ThemeProvider";
import { TRPCErrorBoundaryWithQueryInvalidation } from "@/components/TRPCErrorBoundary";
import { Toaster } from "@/components/ui/Toaster";
import i18n from "@/lib/i18n";
import { DEFAULT_LANGUAGE, normalizeLanguage } from "@/lib/i18nConfig";
import { I18nextProvider } from "@/lib/i18nClient";
import { TRPCProvider } from "@/lib/trpc/react";

export const Providers = ({
	session,
	nonce,
	children,
}: {
	session: Session | null;
	nonce?: string;
	children: React.ReactNode;
}) => {
	useEffect(() => {
		const nextLanguage = normalizeLanguage(session?.user?.language ?? DEFAULT_LANGUAGE);
		if (i18n.language !== nextLanguage) {
			i18n.changeLanguage(nextLanguage);
		}
	}, [session?.user?.language]);

	return (
		<SessionProvider session={session}>
			<I18nextProvider i18n={i18n}>
				<TRPCProvider>
					<TRPCErrorBoundaryWithQueryInvalidation>
						<ThemeProvider attribute="class" defaultTheme="system" enableSystem disableTransitionOnChange nonce={nonce}>
							<PullToRefresh />
							<PageTransition>{children}</PageTransition>
							<Toaster />
						</ThemeProvider>
					</TRPCErrorBoundaryWithQueryInvalidation>
				</TRPCProvider>
			</I18nextProvider>
		</SessionProvider>
	);
};
