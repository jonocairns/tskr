import { createFileRoute } from "@tanstack/react-router";

import { auth } from "@/auth/auth";

// Handle Prisma P2025 errors (record not found) gracefully
// This can happen when Better Auth tries to delete a session that was already deleted
const isPrismaNotFoundError = (error: unknown): boolean => {
	return (
		error !== null &&
		typeof error === "object" &&
		"code" in error &&
		(error as { code: string }).code === "P2025"
	);
};

export const Route = createFileRoute("/api/auth/$")({
	server: {
		handlers: {
			GET: async ({ request }) => {
				try {
					return await auth.handler(request);
				} catch (error) {
					if (isPrismaNotFoundError(error)) {
						// Session was already deleted, return success for sign-out
						console.warn("[auth] Session not found during GET, ignoring");
						return new Response(JSON.stringify({ success: true }), {
							status: 200,
							headers: { "Content-Type": "application/json" },
						});
					}
					console.error("[auth] GET handler error:", error);
					throw error;
				}
			},
			POST: async ({ request }) => {
				try {
					return await auth.handler(request);
				} catch (error) {
					if (isPrismaNotFoundError(error)) {
						// Session was already deleted, return success for sign-out
						console.warn("[auth] Session not found during POST, ignoring");
						return new Response(JSON.stringify({ success: true }), {
							status: 200,
							headers: { "Content-Type": "application/json" },
						});
					}
					console.error("[auth] POST handler error:", error);
					throw error;
				}
			},
		},
	},
});
