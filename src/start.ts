import { randomBytes } from "node:crypto";
import { createMiddleware, createStart } from "@tanstack/react-start";

import { buildCsp } from "../csp";
import { buildSecurityHeaders } from "../headers";

const securityMiddleware = createMiddleware().server(async ({ next }) => {
	const nonce = randomBytes(16).toString("base64");
	const result = await next({ context: { cspNonce: nonce } });
	const responseHeaders = new Headers(result.response.headers);

	for (const { key, value } of buildSecurityHeaders()) {
		responseHeaders.set(key, value);
	}

	responseHeaders.set("Content-Security-Policy", buildCsp(nonce));

	return {
		...result,
		response: new Response(result.response.body, {
			status: result.response.status,
			statusText: result.response.statusText,
			headers: responseHeaders,
		}),
	};
});

export const startInstance = createStart(() => ({
	requestMiddleware: [securityMiddleware],
}));
