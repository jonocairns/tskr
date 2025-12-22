import type { Metadata } from "next";
import { getServerSession } from "next-auth";
import { Geist, Geist_Mono } from "next/font/google";

import { Providers } from "@/components/providers";
import { authOptions } from "@/lib/auth";
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
	title: "Taskr points",
	description: "Track and reward chores with time-based points.",
	manifest: "/manifest.json",
	themeColor: "#f8fafc",
	appleWebApp: {
		capable: true,
		title: "Taskr",
		statusBarStyle: "default",
	},
	icons: {
		icon: [
			{ url: "/icon-192.png", sizes: "192x192", type: "image/png" },
			{ url: "/icon-512.png", sizes: "512x512", type: "image/png" },
		],
		apple: [{ url: "/apple-touch-icon.png", sizes: "180x180", type: "image/png" }],
	},
};

export default async function RootLayout({
	children,
}: Readonly<{
	children: React.ReactNode;
}>) {
	const session = await getServerSession(authOptions);

	return (
		<html lang="en" suppressHydrationWarning>
			<body
				className={`${geistSans.variable} ${geistMono.variable} min-h-screen bg-background font-sans antialiased`}
			>
				<Providers session={session}>{children}</Providers>
			</body>
		</html>
	);
}
