import { createFileRoute, redirect } from "@tanstack/react-router";
import { createServerFn } from "@tanstack/react-start";
import { getRequestHeaders } from "@tanstack/react-start/server";

import { auth } from "@/auth/auth";
import { getActiveHouseholdMembership } from "@/lib/households";

const handleLinkCallback = createServerFn({ method: "GET" })
	.inputValidator((data: { returnTo?: string }) => data)
	.handler(async ({ data: { returnTo } }) => {
		const headers = getRequestHeaders();
		const session = await auth.api.getSession({ headers });

		if (!session?.user?.id) {
			throw redirect({ to: "/" });
		}

		// Get active household for redirect
		const active = await getActiveHouseholdMembership(session.user.id);

		if (!active) {
			throw redirect({ to: "/landing" });
		}

		// Determine where to redirect
		let redirectTo = returnTo;
		if (!redirectTo || !redirectTo.startsWith("/")) {
			redirectTo = `/${active.householdId}/settings`;
		}

		// Set a flag in the URL to show success toast on the settings page
		// The settings page will read this and show the toast
		return {
			redirectTo,
			householdId: active.householdId,
		};
	});

export const Route = createFileRoute("/auth/link")({
	validateSearch: (search: Record<string, unknown>) => ({
		returnTo: typeof search.returnTo === "string" ? search.returnTo : undefined,
	}),
	loaderDeps: ({ search }) => ({ returnTo: search.returnTo }),
	loader: async ({ deps }) => {
		const result = await handleLinkCallback({ data: { returnTo: deps.returnTo } });

		// Store success flag in sessionStorage via a client-side effect
		// Then redirect to the target page
		return result;
	},
	component: LinkCallbackPage,
});

function LinkCallbackPage() {
	const data = Route.useLoaderData();

	// Set the success flag and redirect
	if (typeof window !== "undefined") {
		window.sessionStorage.setItem("googleLinkSuccess", "true");
		window.location.href = data.redirectTo;
	}

	return (
		<div className="flex min-h-screen items-center justify-center">
			<p className="text-muted-foreground">Linking account...</p>
		</div>
	);
}
