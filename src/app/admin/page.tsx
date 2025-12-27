import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";

import { AuthCta } from "@/components/AuthCta";
import { PageHeader } from "@/components/PageHeader";
import { PageShell } from "@/components/PageShell";
import { AuthSettingsCard } from "@/components/admin/AuthSettingsCard";
import { UsersCard } from "@/components/admin/UsersCard";
import { getAppSettings } from "@/lib/appSettings";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

export default async function AdminPage() {
	const session = await getServerSession(authOptions);

	if (!session?.user?.id) {
		return (
			<PageShell layout="centered" size="lg">
				<AuthCta />
			</PageShell>
		);
	}

	if (!session.user.isSuperAdmin) {
		redirect("/");
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
		hasGoogleAccount: accounts.length > 0,
	}));
	const settings = await getAppSettings();

	return (
		<PageShell size="lg">
			<PageHeader
				eyebrow="tskr"
				title="Admin"
				description="Generate reset links for user passwords."
				backHref="/"
				backLabel="Back to dashboard"
				user={session.user}
			/>
			<AuthSettingsCard
				initialAllowGoogleAccountCreation={settings.allowGoogleAccountCreation}
			/>
			<UsersCard users={userRows} currentUserId={session.user.id} />
		</PageShell>
	);
}
