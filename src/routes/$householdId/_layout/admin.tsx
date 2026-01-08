import { createFileRoute, redirect } from "@tanstack/react-router";
import { createServerFn } from "@tanstack/react-start";

import { AuthSettingsCard } from "@/components/admin/AuthSettingsCard";
import { UsersCard } from "@/components/admin/UsersCard";
import { PageHeader } from "@/components/PageHeader";
import { PageShell } from "@/components/PageShell";
import { getAppSettings } from "@/lib/appSettings";
import { prisma } from "@/lib/prisma";
import { requireValidSession } from "@/lib/sessionServer";
import type { HouseholdContext } from "../_layout";

const loadAdmin = createServerFn({ method: "GET" })
	.inputValidator((data: { householdId: string }) => data)
		.handler(async ({ data: { householdId } }) => {
		const googleEnabled = Boolean(process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET);
		const session = await requireValidSession();

		const isSuperAdmin = (session.user as { isSuperAdmin?: boolean }).isSuperAdmin ?? false;

		// Authorization check - only super admins can access
		if (!isSuperAdmin) {
			throw redirect({ to: "/$householdId", params: { householdId } });
		}

		const users = await prisma.user.findMany({
			select: {
				id: true,
				name: true,
				email: true,
				createdAt: true,
				isSuperAdmin: true,
				accounts: {
					select: {
						providerId: true,
						passwordResetRequired: true,
						disabled: true,
					},
				},
			},
			orderBy: { createdAt: "asc" },
		});

		const userRows = users.map(({ accounts, ...user }) => {
			const credentialAccount = accounts.find((a) => a.providerId === "credential");
			const hasGoogleAccount = googleEnabled && accounts.some((a) => a.providerId === "google");
			return {
				...user,
				createdAt: user.createdAt.toISOString(),
				hasGoogleAccount,
				passwordResetRequired: credentialAccount?.passwordResetRequired ?? false,
				credentialDisabled: credentialAccount?.disabled ?? false,
			};
		});

		const settings = googleEnabled ? await getAppSettings() : null;

		return {
			userRows,
			googleEnabled,
			settings,
		};
	});

export const Route = createFileRoute("/$householdId/_layout/admin")({
	loader: async ({ params, context }) => {
		const { householdContext } = context as { householdContext: HouseholdContext };
		const data = await loadAdmin({
			data: {
				householdId: params.householdId,
			},
		});
		return { ...data, householdContext };
	},
	component: AdminPage,
});

function AdminPage() {
	const data = Route.useLoaderData();
	const { householdContext } = data;

	return (
		<PageShell size="lg">
			<PageHeader
				eyebrow="tskr"
				title="Admin"
				description="Generate reset links for user passwords."
				backHref={`/${householdContext.householdId}/settings`}
				backLabel="Back to settings"
				user={householdContext.session.user}
				household={{ id: householdContext.householdId, role: householdContext.membership.role }}
			/>
			{data.googleEnabled && data.settings ? (
				<AuthSettingsCard initialAllowGoogleAccountCreation={data.settings.allowGoogleAccountCreation} />
			) : null}
			<UsersCard
				users={data.userRows}
				currentUserId={householdContext.session.user.id}
				googleEnabled={data.googleEnabled}
			/>
		</PageShell>
	);
}
