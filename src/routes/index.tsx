import { createFileRoute, redirect } from "@tanstack/react-router";
import { createServerFn } from "@tanstack/react-start";
import { getRequestHeaders } from "@tanstack/react-start/server";

import { auth } from "@/auth/auth";
import { AuthCta } from "@/components/AuthCta";
import { PageShell } from "@/components/PageShell";
import { getAuthErrorMessage } from "@/lib/authError";
import { getActiveHouseholdMembership } from "@/lib/households";

const loadIndexPage = createServerFn({ method: "GET" })
	.inputValidator((data: { error?: string }) => data)
	.handler(async ({ data }) => {
		const googleEnabled = Boolean(process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET);
		const headers = getRequestHeaders();
		const session = await auth.api.getSession({ headers });

		if (!session?.user?.id) {
			const authError = data.error ? getAuthErrorMessage(data.error) : null;
			return {
				authenticated: false as const,
				authError,
				googleEnabled,
			};
		}

		const active = await getActiveHouseholdMembership(session.user.id);

		if (!active) {
			throw redirect({ to: "/landing" });
		}

		throw redirect({ to: "/$householdId", params: { householdId: active.householdId } });
	});

export const Route = createFileRoute("/")({
	validateSearch: (search: Record<string, unknown>) => ({
		error: typeof search.error === "string" ? search.error : undefined,
	}),
	loaderDeps: ({ search }) => ({ error: search.error }),
	loader: ({ deps }) => loadIndexPage({ data: { error: deps.error } }),
	component: IndexPage,
});

function IndexPage() {
	const data = Route.useLoaderData();

	if (data.authenticated === false) {
		return (
			<PageShell layout="centered" size="lg">
				<AuthCta authError={data.authError} googleEnabled={data.googleEnabled} />
			</PageShell>
		);
	}

	// This shouldn't render - we redirect in the loader
	return null;
}
