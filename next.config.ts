import type { NextConfig } from "next";
import { buildSecurityHeaders } from "./headers";

const nextConfig: NextConfig = {
	output: "standalone",
	async headers() {
		const headers = buildSecurityHeaders();

		return [
			{
				source: "/(.*)",
				headers,
			},
		];
	},
};

export default nextConfig;
