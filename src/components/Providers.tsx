"use client";

import type { Session } from "next-auth";
import { SessionProvider } from "next-auth/react";

import { PageTransition } from "@/components/PageTransition";
import { PullToRefresh } from "@/components/PullToRefresh";
import { ThemeProvider } from "@/components/ThemeProvider";
import { Toaster } from "@/components/ui/Toaster";

export const Providers = ({
	session,
	children,
}: {
	session: Session | null;
	children: React.ReactNode;
}) => {
	return (
		<SessionProvider session={session}>
			<ThemeProvider
				attribute="class"
				defaultTheme="system"
				enableSystem
				disableTransitionOnChange
			>
				<PullToRefresh />
				<PageTransition>{children}</PageTransition>
				<Toaster />
			</ThemeProvider>
		</SessionProvider>
	);
};
