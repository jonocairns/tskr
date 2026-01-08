import { createFileRoute } from "@tanstack/react-router";
import { fetchRequestHandler } from "@trpc/server/adapters/fetch";

import { appRouter } from "@/server/routers/_app";
import { createTRPCContext } from "@/server/trpc";
import { config } from "@/server-config";

function validateOrigin(req: Request): boolean {
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

	const forwardedOrigin = getForwardedOrigin(req);
	if (forwardedOrigin && isAllowedOrigin(forwardedOrigin)) {
		return true;
	}

	const requestOrigin = getRequestOrigin(req);
	if (requestOrigin && isAllowedOrigin(requestOrigin)) {
		return true;
	}

	const host = req.headers.get("host");
	if (host) {
		const hostOrigin = getOriginFromHost(host);
		if (hostOrigin && isAllowedOrigin(hostOrigin)) {
			return true;
		}
	}

	return false;
}

function getForwardedOrigin(req: Request): string | null {
	const forwardedHost = req.headers.get("x-forwarded-host");
	if (!forwardedHost) {
		return null;
	}

	const host = forwardedHost.split(",")[0]?.trim();
	if (!host) {
		return null;
	}

	const forwardedProto = req.headers.get("x-forwarded-proto");
	const proto = forwardedProto?.split(",")[0]?.trim();

	if (proto) {
		try {
			return new URL(`${proto}://${host}`).origin;
		} catch {
			return null;
		}
	}

	return getOriginFromHost(host);
}

function getRequestOrigin(req: Request): string | null {
	try {
		return new URL(req.url).origin;
	} catch {
		return null;
	}
}

function getOriginFromHost(host: string): string | null {
	try {
		const appOrigin = new URL(config.appUrl);
		return new URL(`${appOrigin.protocol}//${host}`).origin;
	} catch {
		return null;
	}
}

function isAllowedOrigin(origin: string): boolean {
	const appUrl = config.appUrl;
	let appOrigin: string;

	try {
		appOrigin = new URL(appUrl).origin;
	} catch {
		return false;
	}

	if (config.isDev) {
		try {
			const originUrl = new URL(origin);
			const appUrlObj = new URL(appOrigin);

			if (originUrl.hostname === "localhost" || originUrl.hostname === "127.0.0.1") {
				return appUrlObj.hostname === "localhost" || appUrlObj.hostname === "127.0.0.1";
			}
		} catch {
			return false;
		}
	}

	return origin === appOrigin;
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
