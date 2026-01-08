import { createFileRoute, redirect } from "@tanstack/react-router";
import { createServerFn } from "@tanstack/react-start";
import { getRequestHeaders } from "@tanstack/react-start/server";

import { auth } from "@/auth/auth";
import { AuthSettingsCard } from "@/components/admin/AuthSettingsCard";
import { UsersCard } from "@/components/admin/UsersCard";
import { PageHeader } from "@/components/PageHeader";
import { PageShell } from "@/components/PageShell";
import { getAppSettings } from "@/lib/appSettings";
import { getHouseholdMembership } from "@/lib/households";
import { prisma } from "@/lib/prisma";
import { config } from "@/server-config";

const isGoogleEnabled = Boolean(config.googleClientId && config.googleClientSecret);

const loadAdmin = createServerFn({ method: "GET" })
	.inputValidator((data: { householdId: string }) => data)
	.handler(async ({ data: { householdId } }) => {
		const headers = getRequestHeaders();
		const session = await auth.api.getSession({ headers });

		if (!session?.user?.id) {
			throw redirect({ to: "/" });
		}

		const isSuperAdmin = (session.user as { isSuperAdmin?: boolean }).isSuperAdmin ?? false;

		if (!isSuperAdmin) {
			throw redirect({ to: "/$householdId", params: { householdId } });
		}

		const membership = await getHouseholdMembership(session.user.id, householdId);

		if (!membership) {
			throw redirect({ to: "/landing" });
		}

		const users = await prisma.user.findMany({
			select: {
				id: true,
				name: true,
				email: true,
				createdAt: true,
				isSuperAdmin: true,
				passwordResetRequired: true,
				passwordLoginDisabled: true,
				accounts: {
					where: { providerId: "google" },
					select: { id: true },
					take: 1,
				},
			},
			orderBy: { createdAt: "asc" },
		});

		const userRows = users.map(({ accounts, ...user }) => ({
			...user,
			createdAt: user.createdAt.toISOString(),
			hasGoogleAccount: isGoogleEnabled && accounts.length > 0,
		}));

		const settings = isGoogleEnabled ? await getAppSettings() : null;

		return {
			session: {
				user: {
					id: session.user.id,
					name: session.user.name,
					email: session.user.email,
					image: session.user.image,
					isSuperAdmin: true,
				},
			},
			householdId,
			membership,
			userRows,
			googleEnabled: isGoogleEnabled,
			settings,
		};
	});

export const Route = createFileRoute("/$householdId/_layout/admin")({
	loader: ({ params }) => loadAdmin({ data: { householdId: params.householdId } }),
	component: AdminPage,
});

function AdminPage() {
	const data = Route.useLoaderData();

	return (
		<PageShell size="lg">
			<PageHeader
				eyebrow="tskr"
				title="Admin"
				description="Generate reset links for user passwords."
				backHref={`/${data.householdId}/settings`}
				backLabel="Back to settings"
				user={data.session.user}
				household={{ id: data.householdId, role: data.membership.role }}
			/>
			{data.googleEnabled && data.settings ? (
				<AuthSettingsCard initialAllowGoogleAccountCreation={data.settings.allowGoogleAccountCreation} />
			) : null}
			<UsersCard users={data.userRows} currentUserId={data.session.user.id} googleEnabled={data.googleEnabled} />
		</PageShell>
	);
}
