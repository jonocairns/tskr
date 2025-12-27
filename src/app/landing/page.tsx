import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";

import { AuthCta } from "@/components/AuthCta";
import { PageHeader } from "@/components/PageHeader";
import { PageShell } from "@/components/PageShell";
import { CreateCard } from "@/components/household/CreateCard";
import { JoinCard } from "@/components/household/JoinCard";
import { authOptions } from "@/lib/auth";
import { getActiveHouseholdMembership } from "@/lib/households";

export const dynamic = "force-dynamic";

export default async function LandingPage() {
	const session = await getServerSession(authOptions);

	if (!session?.user?.id) {
		return (
			<PageShell layout="centered" size="lg">
				<AuthCta />
			</PageShell>
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
		<PageShell size="sm">
			<PageHeader
				eyebrow="tskr"
				title="Welcome"
				description="Join an existing household or create a new one."
				user={session.user}
			/>

			<JoinCard redirectTo="/" />
			<CreateCard redirectTo="/" />
		</PageShell>
	);
}
