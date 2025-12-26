import { baseConfig } from "./config";
import { buildCsp } from "./csp";

export const buildSecurityHeaders = () => {
	const csp = buildCsp();

	return [
		{ key: "Content-Security-Policy", value: csp },
		{ key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
		{ key: "X-Content-Type-Options", value: "nosniff" },
		{ key: "X-Frame-Options", value: "DENY" },
		{ key: "X-DNS-Prefetch-Control", value: "off" },
		{
			key: "Permissions-Policy",
			value: "camera=(), microphone=(), geolocation=()",
		},
		{
			key: "Cross-Origin-Opener-Policy",
			value: "same-origin",
		},
		{
			key: "Cross-Origin-Resource-Policy",
			value: "same-origin",
		},
		...(baseConfig.isDev
			? []
			: [
					{
						key: "Strict-Transport-Security",
						value: "max-age=31536000; includeSubDomains",
					},
				]),
	];
};
