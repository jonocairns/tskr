import { redirect } from "next/navigation";
import { getServerSession } from "next-auth";

import { AuthCta } from "@/components/AuthCta";
import { PageShell } from "@/components/PageShell";
import { authOptions } from "@/lib/auth";
import { isGoogleAuthEnabled } from "@/lib/authConfig";
import { getAuthErrorMessage } from "@/lib/authError";
import { getActiveHouseholdMembership } from "@/lib/households";

export const dynamic = "force-dynamic";

type Props = {
	searchParams?: Promise<{ error?: string | string[] }>;
};

export default async function RootPage({ searchParams }: Props) {
	const googleEnabled = isGoogleAuthEnabled;
	const session = await getServerSession(authOptions);

	if (!session?.user?.id) {
		const resolvedSearchParams = searchParams ? await searchParams : {};
		const authError = resolvedSearchParams.error ? getAuthErrorMessage(resolvedSearchParams.error) : null;

		return (
			<PageShell layout="centered" size="lg">
				<AuthCta authError={authError} googleEnabled={googleEnabled} />
			</PageShell>
		);
	}

	const active = await getActiveHouseholdMembership(session.user.id);

	if (!active) {
		redirect("/landing");
	}

	redirect(`/${active.householdId}`);
}
