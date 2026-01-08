import { createFileRoute } from "@tanstack/react-router";
import { createServerFn } from "@tanstack/react-start";
import { getRequestHeaders } from "@tanstack/react-start/server";

import { auth } from "@/auth/auth";
import { PageHeader } from "@/components/PageHeader";
import { PageShell } from "@/components/PageShell";
import { SettingsContent } from "@/components/settings/SettingsContent";
import { getHouseholdMembership } from "@/lib/households";
import { prisma } from "@/lib/prisma";
import { config } from "@/server-config";

const isGoogleEnabled = Boolean(config.googleClientId && config.googleClientSecret);

const loadSettings = createServerFn({ method: "GET" })
	.inputValidator((data: { householdId: string }) => data)
	.handler(async ({ data: { householdId } }) => {
		const headers = getRequestHeaders();
		const session = await auth.api.getSession({ headers });

		if (!session?.user?.id) {
			throw new Error("Unauthorized");
		}

		const membership = await getHouseholdMembership(session.user.id, householdId);

		if (!membership) {
			throw new Error("Not a member");
		}

		const isSuperAdmin = (session.user as { isSuperAdmin?: boolean }).isSuperAdmin ?? false;

		// Check if user has a linked Google account
		const googleAccount = isGoogleEnabled
			? await prisma.account.findFirst({
					where: { userId: session.user.id, providerId: "google" },
					select: { id: true },
				})
			: null;

		return {
			session: {
				user: {
					id: session.user.id,
					name: session.user.name,
					email: session.user.email,
					image: session.user.image,
					hasGoogleAccount: !!googleAccount,
					isSuperAdmin,
				},
			},
			householdId,
			membership,
			googleEnabled: isGoogleEnabled,
		};
	});

export const Route = createFileRoute("/$householdId/_layout/settings")({
	loader: ({ params }) => loadSettings({ data: { householdId: params.householdId } }),
	component: SettingsPage,
});

function SettingsPage() {
	const data = Route.useLoaderData();

	return (
		<PageShell size="lg">
			<PageHeader
				eyebrow="Settings"
				title="Settings"
				description="Manage your account preferences and settings."
				backHref={`/${data.householdId}`}
				backLabel="Back to dashboard"
				user={data.session.user}
				household={{ id: data.householdId, role: data.membership.role }}
			/>
			<SettingsContent user={data.session.user} googleEnabled={data.googleEnabled} householdId={data.householdId} />
		</PageShell>
	);
}
