"use client";

import type { Session } from "next-auth";
import { SessionProvider } from "next-auth/react";

import { PullToRefresh } from "@/components/pull-to-refresh";
import { ThemeProvider } from "@/components/theme-provider";
import { Toaster } from "@/components/ui/toaster";

export function Providers({
	session,
	children,
}: {
	session: Session | null;
	children: React.ReactNode;
}) {
	return (
		<SessionProvider session={session}>
			<ThemeProvider
				attribute="class"
				defaultTheme="system"
				enableSystem
				disableTransitionOnChange
			>
				<PullToRefresh />
				{children}
				<Toaster />
			</ThemeProvider>
		</SessionProvider>
	);
}
