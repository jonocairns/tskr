import { createRootRoute, HeadContent, Outlet, redirect, Scripts, useRouter } from "@tanstack/react-router";
import { createServerFn } from "@tanstack/react-start";
import { getRequestHeaders } from "@tanstack/react-start/server";

import { auth, type Session } from "@/auth/auth";
import { Providers } from "@/components/Providers";
import appCss from "@/globals.css?url";
import { checkPasswordResetRequired } from "@/lib/passwordReset";

const getSession = createServerFn({ method: "GET" }).handler(async () => {
	const headers = getRequestHeaders();
	const session = await auth.api.getSession({ headers });
	return session;
});

const checkPasswordReset = createServerFn({ method: "GET" })
	.inputValidator((data: { userId: string }) => data)
	.handler(async ({ data: { userId } }) => {
		return checkPasswordResetRequired(userId);
	});

export const Route = createRootRoute({
	head: () => ({
		meta: [
			{ charSet: "utf-8" },
			{ name: "viewport", content: "width=device-width, initial-scale=1" },
			{ name: "theme-color", content: "#f8fafc" },
			{ name: "apple-mobile-web-app-capable", content: "yes" },
			{ name: "mobile-web-app-capable", content: "yes" },
			{ name: "apple-mobile-web-app-title", content: "tskr" },
			{ name: "apple-mobile-web-app-status-bar-style", content: "default" },
			{ title: "tskr" },
			{ name: "description", content: "Track and reward tasks with time-based points." },
		],
		links: [
			{ rel: "stylesheet", href: appCss },
			{ rel: "manifest", href: "/manifest.json" },
			{ rel: "icon", href: "/favicon.png", sizes: "32x32", type: "image/png" },
			{ rel: "icon", href: "/icon-192.png", sizes: "192x192", type: "image/png" },
			{ rel: "icon", href: "/icon-512.png", sizes: "512x512", type: "image/png" },
			{ rel: "apple-touch-icon", href: "/apple-touch-icon.png", sizes: "180x180" },
		],
	}),
	beforeLoad: async ({ location, context }) => {
		const pathname = location.pathname;

		// Public routes that don't require authentication or session fetching
		const isPublicRoute =
			pathname === "/" ||
			pathname.startsWith("/api/") ||
			pathname.startsWith("/reset-password") ||
			pathname.startsWith("/auth/") ||
			pathname === "/landing";

		// Skip session fetch for API routes - they handle their own auth
		if (pathname.startsWith("/api/")) {
			return { session: null };
		}

		// Use cached session from context if available (subsequent navigations)
		// This avoids server round-trips on client-side navigation
		let session: Session | null = (context as { session?: Session | null }).session ?? null;

		// Only fetch session if we don't have it cached
		if (!session) {
			session = await getSession();
		}

		// Redirect unauthenticated users to login (except for public routes)
		if (!session?.user?.id && !isPublicRoute) {
			throw redirect({ to: "/", search: { error: undefined } });
		}

		// Check if user needs to reset their password
		// Skip this check for reset-password routes to avoid infinite loops
		if (session?.user?.id && !pathname.startsWith("/reset-password") && !isPublicRoute) {
			const resetRequired = await checkPasswordReset({ data: { userId: session.user.id } });
			if (resetRequired) {
				throw redirect({ to: "/reset-password" });
			}
		}

		return { session };
	},
	component: RootComponent,
});

function RootComponent() {
	const router = useRouter();
	const nonce = router.options.ssr?.nonce;

	return (
		<html lang="en" suppressHydrationWarning>
			<head>
				<HeadContent />
				{nonce ? <meta property="csp-nonce" content={nonce} /> : null}
			</head>
			<body className="min-h-screen bg-background font-sans antialiased">
				<Providers nonce={nonce}>
					<Outlet />
				</Providers>
				<Scripts />
			</body>
		</html>
	);
}
