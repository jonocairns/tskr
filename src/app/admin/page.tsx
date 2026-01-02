import { redirect } from "next/navigation";
import { getServerSession } from "next-auth";

import { AuthCta } from "@/components/AuthCta";
import { PageShell } from "@/components/PageShell";
import { authOptions } from "@/lib/auth";
import { isGoogleAuthEnabled } from "@/lib/authConfig";
import { getActiveHouseholdMembership } from "@/lib/households";

export const dynamic = "force-dynamic";

export default async function AdminPage() {
	const googleEnabled = isGoogleAuthEnabled;
	const session = await getServerSession(authOptions);

	if (!session?.user?.id) {
		return (
			<PageShell layout="centered" size="lg">
				<AuthCta googleEnabled={googleEnabled} />
			</PageShell>
		);
	}

	if (!session.user.isSuperAdmin) {
		redirect("/");
	}

	const active = await getActiveHouseholdMembership(session.user.id);

	if (!active) {
		redirect("/landing?error=NoHouseholdMembership");
	}

	redirect(`/${active.householdId}/admin`);
}
