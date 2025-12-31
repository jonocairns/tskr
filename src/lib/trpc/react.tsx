"use client";

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { httpBatchLink } from "@trpc/client";
import { createTRPCReact } from "@trpc/react-query";
import { useState } from "react";
import superjson from "superjson";

import type { AppRouter } from "@/server/routers/_app";

export const trpc = createTRPCReact<AppRouter>();

/**
 * Stale time recommendations for different query types:
 * - Static/rarely changing data (app settings, presets): 5-10 minutes or Infinity
 * - User data (profile, household info): 30-60 seconds (default)
 * - Real-time data (logs, assigned tasks): 0-5 seconds
 * - List data with pagination: 30 seconds
 *
 * Override per-query:
 * ```tsx
 * const { data } = trpc.households.getCurrent.useQuery(undefined, {
 *   staleTime: 60 * 1000, // 1 minute
 * });
 * ```
 */

function getBaseUrl() {
	if (typeof window !== "undefined") return "";
	return "";
}

export function TRPCProvider({ children }: { children: React.ReactNode }) {
	const [queryClient] = useState(
		() =>
			new QueryClient({
				defaultOptions: {
					queries: {
						// Default stale time: 30 seconds for most data
						// This balances freshness with performance
						staleTime: 30 * 1000,
						refetchOnWindowFocus: false,
						// Retry failed queries once after a short delay
						retry: 1,
						retryDelay: 1000,
					},
				},
			}),
	);

	const [trpcClient] = useState(() =>
		trpc.createClient({
			links: [
				httpBatchLink({
					url: `${getBaseUrl()}/api/trpc`,
					transformer: superjson,
				}),
			],
		}),
	);

	return (
		<trpc.Provider client={trpcClient} queryClient={queryClient}>
			<QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
		</trpc.Provider>
	);
}
