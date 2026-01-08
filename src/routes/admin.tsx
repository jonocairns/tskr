import { createFileRoute, redirect } from "@tanstack/react-router";
import { createServerFn } from "@tanstack/react-start";
import { getRequestHeaders } from "@tanstack/react-start/server";

import { auth } from "@/auth/auth";
import { AuthCta } from "@/components/AuthCta";
import { PageShell } from "@/components/PageShell";
import { getActiveHouseholdMembership } from "@/lib/households";
import { config } from "@/server-config";

const isGoogleEnabled = Boolean(config.googleClientId && config.googleClientSecret);

const loadAdminRedirect = createServerFn({ method: "GET" }).handler(async () => {
	const headers = getRequestHeaders();
	const session = await auth.api.getSession({ headers });

	console.log("[admin] Session user:", JSON.stringify(session?.user, null, 2));

	if (!session?.user?.id) {
		return {
			authenticated: false as const,
			googleEnabled: isGoogleEnabled,
		};
	}

	const isSuperAdmin = (session.user as { isSuperAdmin?: boolean }).isSuperAdmin ?? false;
	console.log("[admin] isSuperAdmin:", isSuperAdmin);

	if (!isSuperAdmin) {
		throw redirect({ to: "/", search: { error: undefined } });
	}

	const active = await getActiveHouseholdMembership(session.user.id);

	if (!active) {
		throw redirect({ to: "/landing", search: { error: "NoHouseholdMembership" } });
	}

	throw redirect({ to: "/$householdId/admin", params: { householdId: active.householdId } });
});

export const Route = createFileRoute("/admin")({
	loader: () => loadAdminRedirect(),
	component: AdminPage,
});

function AdminPage() {
	const data = Route.useLoaderData();

	if (data.authenticated === false) {
		return (
			<PageShell layout="centered" size="lg">
				<AuthCta googleEnabled={data.googleEnabled} />
			</PageShell>
		);
	}

	return null;
}
