import { createFileRoute, redirect } from "@tanstack/react-router";
import { createServerFn } from "@tanstack/react-start";

import { PageHeader } from "@/components/PageHeader";
import { PageShell } from "@/components/PageShell";
import { SettingsContent } from "@/components/settings/SettingsContent";
import { getActiveHouseholdMembership, getHouseholdMembership } from "@/lib/households";
import { prisma } from "@/lib/prisma";
import { requireValidSession } from "@/lib/sessionServer";
import type { HouseholdContext } from "../_layout";

const loadSettings = createServerFn({ method: "GET" })
	.inputValidator((data: { householdId: string }) => data)
		.handler(async ({ data: { householdId } }) => {
		const googleEnabled = Boolean(process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET);
		const session = await requireValidSession();

		const membership = await getHouseholdMembership(session.user.id, householdId);
		if (!membership) {
			const active = await getActiveHouseholdMembership(session.user.id);
			if (active) {
				throw redirect({
					to: "/$householdId",
					params: { householdId: active.householdId },
					search: { error: "HouseholdAccessDenied" },
				});
			}
			throw redirect({ to: "/landing", search: { error: "NoHouseholdMembership" } });
		}

		const userId = session.user.id;
		// Check if user has a linked Google account
		const googleAccount = googleEnabled
			? await prisma.account.findFirst({
					where: { userId, providerId: "google" },
					select: { id: true },
				})
			: null;

		return {
			hasGoogleAccount: !!googleAccount,
			googleEnabled,
		};
	});

export const Route = createFileRoute("/$householdId/_layout/settings")({
	loader: async ({ params, context }) => {
		const { householdContext } = context as { householdContext: HouseholdContext };
		const data = await loadSettings({
			data: { householdId: params.householdId },
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
