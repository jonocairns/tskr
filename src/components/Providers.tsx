"use client";

import type { Session } from "next-auth";
import { SessionProvider } from "next-auth/react";

import { PageTransition } from "@/components/PageTransition";
import { PullToRefresh } from "@/components/PullToRefresh";
import { ThemeProvider } from "@/components/ThemeProvider";
import { TRPCErrorBoundary } from "@/components/TRPCErrorBoundary";
import { Toaster } from "@/components/ui/Toaster";
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
	return (
		<SessionProvider session={session}>
			<TRPCProvider>
				<TRPCErrorBoundary>
					<ThemeProvider attribute="class" defaultTheme="system" enableSystem disableTransitionOnChange nonce={nonce}>
						<PullToRefresh />
						<PageTransition>{children}</PageTransition>
						<Toaster />
					</ThemeProvider>
				</TRPCErrorBoundary>
			</TRPCProvider>
		</SessionProvider>
	);
};
