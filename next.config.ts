import type { NextConfig } from "next";
import { buildSecurityHeaders } from "./headers";

const nextConfig: NextConfig = {
	output: "standalone",
	async headers() {
		return [
			{
				source: "/:path*",
				headers: buildSecurityHeaders(),
			},
		];
	},
	images: {
		remotePatterns: [
			{
				protocol: "https",
				hostname: "*.googleusercontent.com",
			},
		],
	},
};

export default nextConfig;
