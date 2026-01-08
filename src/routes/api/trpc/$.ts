import { createFileRoute } from "@tanstack/react-router";
import { fetchRequestHandler } from "@trpc/server/adapters/fetch";

import { appRouter } from "@/server/routers/_app";
import { createTRPCContext } from "@/server/trpc";
import { config } from "@/server-config";

function validateOrigin(req: Request): boolean {
	if (req.method === "GET") {
		return true;
	}

	const origin = req.headers.get("origin");
	if (origin) {
		return isAllowedOrigin(origin);
	}

	const referer = req.headers.get("referer");
	if (referer) {
		try {
			const refererUrl = new URL(referer);
			return isAllowedOrigin(refererUrl.origin);
		} catch {
			return false;
		}
	}

	return false;
}

function isAllowedOrigin(origin: string): boolean {
	const appUrl = config.appUrl;

	if (config.isDev) {
		try {
			const originUrl = new URL(origin);
			const appUrlObj = new URL(appUrl);

			if (originUrl.hostname === "localhost" || originUrl.hostname === "127.0.0.1") {
				return appUrlObj.hostname === "localhost" || appUrlObj.hostname === "127.0.0.1";
			}
		} catch {
			return false;
		}
	}

	return origin === appUrl;
}

async function handleRequest(req: Request) {
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
		createContext: () => createTRPCContext({ req }),
	});
}

export const Route = createFileRoute("/api/trpc/$")({
	server: {
		handlers: {
			GET: ({ request }) => handleRequest(request),
			POST: ({ request }) => handleRequest(request),
		},
	},
});
