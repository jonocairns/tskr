import type { Metadata } from "next";
import { getServerSession } from "next-auth";
import { Geist, Geist_Mono } from "next/font/google";
import { headers } from "next/headers";

import { Providers } from "@/components/Providers";
import { authOptions } from "@/lib/auth";
import { getCspNonce } from "@/lib/cspNonce";
import "./globals.css";

const geistSans = Geist({
	variable: "--font-geist-sans",
	subsets: ["latin"],
});

const geistMono = Geist_Mono({
	variable: "--font-geist-mono",
	subsets: ["latin"],
});

export const metadata: Metadata = {
	title: "tskr",
	description: "Track and reward tasks with time-based points.",
	manifest: "/manifest.json",
	appleWebApp: {
		capable: true,
		title: "tskr",
		statusBarStyle: "default",
	},
	icons: {
		icon: [
			{ url: "/favicon.png", sizes: "32x32", type: "image/png" },
			{ url: "/icon-192.png", sizes: "192x192", type: "image/png" },
			{ url: "/icon-512.png", sizes: "512x512", type: "image/png" },
		],
		apple: [{ url: "/apple-touch-icon.png", sizes: "180x180", type: "image/png" }],
	},
};

export const viewport = {
	themeColor: "#f8fafc",
};

export default async function RootLayout({
	children,
}: Readonly<{
	children: React.ReactNode;
}>) {
	const session = await getServerSession(authOptions);
	const headerList = await headers();
	const cspHeader = headerList.get("content-security-policy") ?? headerList.get("content-security-policy-report-only");
	const nonce = getCspNonce(cspHeader);

	return (
		<html lang="en" suppressHydrationWarning>
			<body className={`${geistSans.variable} ${geistMono.variable} min-h-screen bg-background font-sans antialiased`}>
				<Providers session={session} nonce={nonce}>
					{children}
				</Providers>
			</body>
		</html>
	);
}
