import { config } from "./config";

export const buildCsp = () =>
	[
		"default-src 'self'",
		"base-uri 'self'",
		"object-src 'none'",
		"frame-ancestors 'none'",
		"form-action 'self'",
		`script-src 'self' 'unsafe-inline'${config.isDev ? " 'unsafe-eval'" : ""}`,
		"style-src 'self' 'unsafe-inline'",
		"img-src 'self' data: blob:",
		"font-src 'self' data:",
		"connect-src 'self' https: wss:",
		"worker-src 'self' blob:",
	].join("; ");
