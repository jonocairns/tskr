import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";

import { AuthCta } from "@/components/AuthCta";
import { PageHeader } from "@/components/PageHeader";
import { CreateCard } from "@/components/household/CreateCard";
import { JoinCard } from "@/components/household/JoinCard";
import { authOptions } from "@/lib/auth";
import { getActiveHouseholdMembership } from "@/lib/households";

export const dynamic = "force-dynamic";

export default async function LandingPage() {
	const session = await getServerSession(authOptions);

	if (!session?.user?.id) {
		return (
			<main className="flex min-h-screen items-center bg-gradient-to-br from-background via-background to-muted px-4 py-12">
				<AuthCta />
			</main>
		);
	}

	const active = await getActiveHouseholdMembership(
		session.user.id,
		session.user.householdId ?? null,
	);
	if (active) {
		redirect("/");
	}

	return (
		<main className="min-h-screen bg-gradient-to-br from-background via-background to-muted">
			<div className="mx-auto flex max-w-3xl flex-col gap-6 px-4 py-10">
				<PageHeader
					eyebrow="tskr"
					title="Welcome to tskr"
					description="Join an existing household or create a new one."
					user={session.user}
				/>

				<JoinCard redirectTo="/" />
				<CreateCard redirectTo="/" />
			</div>
		</main>
	);
}
