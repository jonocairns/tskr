import { redirect } from "next/navigation";

import { AuthSettingsCard } from "@/components/admin/AuthSettingsCard";
import { UsersCard } from "@/components/admin/UsersCard";
import { PageHeader } from "@/components/PageHeader";
import { PageShell } from "@/components/PageShell";
import { getAppSettings } from "@/lib/appSettings";
import { isGoogleAuthEnabled } from "@/lib/authConfig";
import { prisma } from "@/lib/prisma";
import { getHouseholdContext } from "@/lib/serverAuth";

export const dynamic = "force-dynamic";

type Props = {
	params: Promise<{ householdId: string }>;
};

export default async function AdminPage({ params }: Props) {
	const googleEnabled = isGoogleAuthEnabled;
	const { householdId } = await params;
	const { session, membership } = await getHouseholdContext(householdId);

	if (!session.user.isSuperAdmin) {
		redirect(`/${householdId}`);
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
				where: { provider: "google" },
				select: { id: true },
				take: 1,
			},
		},
		orderBy: { createdAt: "asc" },
	});
	const userRows = users.map(({ accounts, ...user }) => ({
		...user,
		createdAt: user.createdAt.toISOString(),
		hasGoogleAccount: googleEnabled && accounts.length > 0,
	}));
	const settings = googleEnabled ? await getAppSettings() : null;

	return (
		<PageShell size="lg">
			<PageHeader
				eyebrow="tskr"
				title="Admin"
				description="Generate reset links for user passwords."
				backHref={`/${householdId}/settings`}
				backLabel="Back to settings"
				user={session.user}
				household={{ id: householdId, role: membership.role }}
			/>
			{googleEnabled && settings ? (
				<AuthSettingsCard initialAllowGoogleAccountCreation={settings.allowGoogleAccountCreation} />
			) : null}
			<UsersCard users={userRows} currentUserId={session.user.id} googleEnabled={googleEnabled} />
		</PageShell>
	);
}
