import { redirect } from "next/navigation";
import { getServerSession } from "next-auth";

import { AuthCta } from "@/components/AuthCta";
import { HouseholdErrorToast } from "@/components/HouseholdErrorToast";
import { CreateCard } from "@/components/household/CreateCard";
import { JoinCard } from "@/components/household/JoinCard";
import { PageHeader } from "@/components/PageHeader";
import { PageShell } from "@/components/PageShell";
import { authOptions } from "@/lib/auth";
import { isGoogleAuthEnabled } from "@/lib/authConfig";
import { getActiveHouseholdMembership } from "@/lib/households";

export const dynamic = "force-dynamic";

export default async function LandingPage() {
	const session = await getServerSession(authOptions);
	const googleEnabled = isGoogleAuthEnabled;

	if (!session?.user?.id) {
		return (
			<PageShell layout="centered" size="lg">
				<AuthCta googleEnabled={googleEnabled} />
			</PageShell>
		);
	}

	const active = await getActiveHouseholdMembership(session.user.id);
	if (active) {
		redirect(`/${active.householdId}`);
	}

	return (
		<PageShell size="sm">
			<HouseholdErrorToast />

			<PageHeader
				eyebrow="tskr"
				title="Welcome"
				description="Join an existing household or create a new one."
				user={session.user}
			/>

			<JoinCard />
			<CreateCard />
		</PageShell>
	);
}
