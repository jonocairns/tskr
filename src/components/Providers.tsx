"use client";

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import type { Session } from "next-auth";
import { SessionProvider } from "next-auth/react";
import { useState } from "react";

import { PageTransition } from "@/components/PageTransition";
import { PullToRefresh } from "@/components/PullToRefresh";
import { ThemeProvider } from "@/components/ThemeProvider";
import { Toaster } from "@/components/ui/Toaster";

export const Providers = ({
	session,
	nonce,
	children,
}: {
	session: Session | null;
	nonce?: string;
	children: React.ReactNode;
}) => {
	const [queryClient] = useState(
		() =>
			new QueryClient({
				defaultOptions: {
					queries: {
						staleTime: 60 * 1000, // 1 minute
						refetchOnWindowFocus: true,
						retry: 1,
					},
				},
			}),
	);

	return (
		<QueryClientProvider client={queryClient}>
			<SessionProvider session={session}>
				<ThemeProvider attribute="class" defaultTheme="system" enableSystem disableTransitionOnChange nonce={nonce}>
					<PullToRefresh />
					<PageTransition>{children}</PageTransition>
					<Toaster />
				</ThemeProvider>
			</SessionProvider>
		</QueryClientProvider>
	);
};
