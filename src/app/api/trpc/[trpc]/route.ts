import { fetchRequestHandler } from "@trpc/server/adapters/fetch";

import { appRouter } from "@/server/routers/_app";
import { createTRPCContext } from "@/server/trpc";
import { config } from "@/server-config";

/**
 * Validates that the request comes from the same origin (CSRF protection).
 * For mutations (POST requests), we verify the origin/referer header matches our app URL.
 */
function validateOrigin(req: Request): boolean {
	// GET requests are safe from CSRF (they should be idempotent)
	if (req.method === "GET") {
		return true;
	}

	// Check Origin header first (more reliable)
	const origin = req.headers.get("origin");
	if (origin) {
		return isAllowedOrigin(origin);
	}

	// Fallback to Referer header (some browsers don't send Origin)
	const referer = req.headers.get("referer");
	if (referer) {
		try {
			const refererUrl = new URL(referer);
			return isAllowedOrigin(refererUrl.origin);
		} catch {
			return false;
		}
	}

	// No origin or referer header - reject for safety
	// This can happen with some API clients, but browser requests should always have one
	return false;
}

function isAllowedOrigin(origin: string): boolean {
	const appUrl = config.appUrl;

	// Handle localhost with any port in development
	if (config.isDev) {
		try {
			const originUrl = new URL(origin);
			const appUrlObj = new URL(appUrl);

			// Allow localhost with any port in dev
			if (originUrl.hostname === "localhost" || originUrl.hostname === "127.0.0.1") {
				return appUrlObj.hostname === "localhost" || appUrlObj.hostname === "127.0.0.1";
			}
		} catch {
			return false;
		}
	}

	// In production, require exact match
	return origin === appUrl;
}

const handler = async (req: Request) => {
	// CSRF protection
	if (!validateOrigin(req)) {
		return new Response(
			JSON.stringify({
				error: {
					message: "Invalid origin",
					code: "FORBIDDEN",
				},
			}),
			{
				status: 403,
				headers: { "Content-Type": "application/json" },
			},
		);
	}

	// Request size limit protection (DoS prevention)
	const contentLength = req.headers.get("content-length");
	if (contentLength && Number.parseInt(contentLength, 10) > config.maxRequestBodySize) {
		return new Response(
			JSON.stringify({
				error: {
					message: "Request body too large",
					code: "PAYLOAD_TOO_LARGE",
				},
			}),
			{
				status: 413,
				headers: { "Content-Type": "application/json" },
			},
		);
	}

	return fetchRequestHandler({
		endpoint: "/api/trpc",
		req,
		router: appRouter,
		createContext: createTRPCContext,
	});
};

export { handler as GET, handler as POST };
