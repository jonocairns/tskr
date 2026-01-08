import { createFileRoute } from "@tanstack/react-router";
import { createServerFn } from "@tanstack/react-start";

import { PageHeader } from "@/components/PageHeader";
import { PageShell } from "@/components/PageShell";
import { SettingsContent } from "@/components/settings/SettingsContent";
import { prisma } from "@/lib/prisma";
import { config } from "@/server-config";

import type { HouseholdContext } from "../_layout";

const isGoogleEnabled = Boolean(config.googleClientId && config.googleClientSecret);

const loadSettings = createServerFn({ method: "GET" })
	.inputValidator((data: { userId: string }) => data)
	.handler(async ({ data: { userId } }) => {
		// Check if user has a linked Google account
		const googleAccount = isGoogleEnabled
			? await prisma.account.findFirst({
					where: { userId, providerId: "google" },
					select: { id: true },
				})
			: null;

		return {
			hasGoogleAccount: !!googleAccount,
			googleEnabled: isGoogleEnabled,
		};
	});

export const Route = createFileRoute("/$householdId/_layout/settings")({
	loader: async ({ context }) => {
		const { householdContext } = context as { householdContext: HouseholdContext };
		const data = await loadSettings({
			data: { userId: householdContext.userId },
		});
		return { ...data, householdContext };
	},
	component: SettingsPage,
});

function SettingsPage() {
	const data = Route.useLoaderData();
	const { householdContext } = data;

	// Extend session user with hasGoogleAccount
	const user = {
		...householdContext.session.user,
		hasGoogleAccount: data.hasGoogleAccount,
	};

	return (
		<PageShell size="lg">
			<PageHeader
				eyebrow="Settings"
				title="Settings"
				description="Manage your account preferences and settings."
				backHref={`/${householdContext.householdId}`}
				backLabel="Back to dashboard"
				user={user}
				household={{ id: householdContext.householdId, role: householdContext.membership.role }}
			/>
			<SettingsContent user={user} googleEnabled={data.googleEnabled} householdId={householdContext.householdId} />
		</PageShell>
	);
}
