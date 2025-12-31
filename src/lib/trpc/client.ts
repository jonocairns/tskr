import { createTRPCClient, httpBatchLink } from "@trpc/client";
import superjson from "superjson";

import type { AppRouter } from "@/server/routers/_app";

function getBaseUrl() {
	if (typeof window !== "undefined") return "";
	if (process.env.VERCEL_URL) return `https://${process.env.VERCEL_URL}`;
	return process.env.NEXTAUTH_URL ?? `http://localhost:${process.env.PORT ?? 3000}`;
}

/**
 * Vanilla tRPC client for server-side usage.
 *
 * IMPORTANT: In most cases, you should use Prisma directly in Server Components
 * instead of this client. This client makes HTTP requests and is less efficient
 * than direct database access.
 *
 * Use this client only when:
 * 1. You need to call tRPC endpoints from API routes or server actions
 * 2. You need to enforce the same authorization logic as the tRPC procedures
 * 3. You're calling tRPC from a separate service
 *
 * Example usage in API route:
 * ```ts
 * import { trpcClient } from "@/lib/trpc/client";
 *
 * export async function GET() {
 *   const result = await trpcClient.households.getCurrent.query();
 *   return Response.json(result);
 * }
 * ```
 *
 * For Server Components, prefer direct Prisma access:
 * ```tsx
 * import { prisma } from "@/lib/prisma";
 *
 * export default async function Page() {
 *   const household = await prisma.household.findUnique({ ... });
 *   return <div>{household.name}</div>;
 * }
 * ```
 */
export const trpcClient = createTRPCClient<AppRouter>({
	links: [
		httpBatchLink({
			url: `${getBaseUrl()}/api/trpc`,
			transformer: superjson,
		}),
	],
});
