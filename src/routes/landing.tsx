import { createFileRoute, redirect } from "@tanstack/react-router";
import { createServerFn } from "@tanstack/react-start";

import { AuthCta } from "@/components/AuthCta";
import { HouseholdErrorToast } from "@/components/HouseholdErrorToast";
import { CreateCard } from "@/components/household/CreateCard";
import { JoinCard } from "@/components/household/JoinCard";
import { PageHeader } from "@/components/PageHeader";
import { PageShell } from "@/components/PageShell";
import { getActiveHouseholdMembership } from "@/lib/households";
import { getValidSession } from "@/lib/sessionServer";

const loadLandingPage = createServerFn({ method: "GET" }).handler(async () => {
	const googleEnabled = Boolean(process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET);
	const session = await getValidSession();

	if (!session?.user?.id) {
		return {
			authenticated: false as const,
			googleEnabled,
		};
	}

	const active = await getActiveHouseholdMembership(session.user.id);
	if (active) {
		throw redirect({ to: "/$householdId", params: { householdId: active.householdId } });
	}

	return {
		authenticated: true as const,
		user: {
			id: session.user.id,
			name: session.user.name,
			email: session.user.email,
			image: session.user.image,
		},
	};
});

export const Route = createFileRoute("/landing")({
	loader: () => loadLandingPage(),
	component: LandingPage,
});

function LandingPage() {
	const data = Route.useLoaderData();

	if (data.authenticated === false) {
		return (
			<PageShell layout="centered" size="lg">
				<AuthCta googleEnabled={data.googleEnabled} />
			</PageShell>
		);
	}

	return (
		<PageShell size="sm">
			<HouseholdErrorToast />

			<PageHeader
				eyebrow="tskr"
				title="Welcome"
				description="Join an existing household or create a new one."
				user={data.user}
			/>

			<JoinCard />
			<CreateCard />
		</PageShell>
	);
}
