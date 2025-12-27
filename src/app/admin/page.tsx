import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";

import { AuthCta } from "@/components/AuthCta";
import { PageHeader } from "@/components/PageHeader";
import { UsersTable } from "@/components/admin/UsersTable";
import {
	Card,
	CardContent,
	CardDescription,
	CardHeader,
	CardTitle,
} from "@/components/ui/Card";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

export default async function AdminPage() {
	const session = await getServerSession(authOptions);

	if (!session?.user?.id) {
		return (
			<main className="flex min-h-screen items-center bg-gradient-to-br from-background via-background to-muted px-4 py-12">
				<AuthCta />
			</main>
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

	return (
		<main className="min-h-screen bg-gradient-to-br from-background via-background to-muted">
			<div className="mx-auto flex max-w-7xl flex-col gap-6 px-4 py-10">
				<PageHeader
					eyebrow="Admin"
					title="Super admin tools"
					description="Generate reset links for user passwords."
					backHref="/"
					backLabel="Back to dashboard"
					user={session.user}
				/>
				<Card>
					<CardHeader>
						<CardTitle>Users</CardTitle>
						<CardDescription>
							Manage users and generate password reset links.
						</CardDescription>
					</CardHeader>
					<CardContent>
						<UsersTable users={userRows} currentUserId={session.user.id} />
					</CardContent>
				</Card>
			</div>
		</main>
	);
}
