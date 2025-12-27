import { type NextRequest, NextResponse } from "next/server";

import { buildCsp } from "../csp";

const generateNonce = () => {
	const bytes = new Uint8Array(16);
	crypto.getRandomValues(bytes);
	return btoa(String.fromCharCode(...bytes));
};

export function proxy(request: NextRequest) {
	const nonce = generateNonce();
	const csp = buildCsp(nonce);
	const requestHeaders = new Headers(request.headers);

	requestHeaders.set("Content-Security-Policy", csp);

	const response = NextResponse.next({
		request: { headers: requestHeaders },
	});
	response.headers.set("Content-Security-Policy", csp);

	return response;
}

export const config = {
	matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
