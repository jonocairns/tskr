import { baseConfig } from "./config";

export const buildCsp = (nonce: string) => {
	const scriptSrc = [
		"'self'",
		`'nonce-${nonce}'`,
		...(baseConfig.isDev ? ["'unsafe-eval'"] : []),
	].join(" ");

	const connectSrc = ["'self'", ...(baseConfig.isDev ? ["ws:"] : [])].join(
		" ",
	);

	return [
		"default-src 'self'",
		"base-uri 'self'",
		"object-src 'none'",
		"frame-ancestors 'none'",
		"form-action 'self'",
		`script-src ${scriptSrc}`,
		"style-src 'self' 'unsafe-inline'",
		"img-src 'self' data: blob: https://*.googleusercontent.com https://authjs.dev",
		"font-src 'self' data:",
		`connect-src ${connectSrc}`,
		"worker-src 'self' blob:",
	].join("; ");
};
