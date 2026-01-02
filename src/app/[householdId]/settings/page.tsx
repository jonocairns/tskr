import { PageHeader } from "@/components/PageHeader";
import { PageShell } from "@/components/PageShell";
import { SettingsContent } from "@/components/settings/SettingsContent";
import { isGoogleAuthEnabled } from "@/lib/authConfig";
import { getHouseholdContext } from "@/lib/serverAuth";

export const dynamic = "force-dynamic";

type Props = {
	params: Promise<{ householdId: string }>;
};

export default async function SettingsPage({ params }: Props) {
	const googleEnabled = isGoogleAuthEnabled;
	const { householdId } = await params;
	const { session, membership } = await getHouseholdContext(householdId);

	return (
		<PageShell size="lg">
			<PageHeader
				eyebrow="Settings"
				title="Settings"
				description="Manage your account preferences and settings."
				backHref={`/${householdId}`}
				backLabel="Back to dashboard"
				user={session.user}
				household={{ id: householdId, role: membership.role }}
			/>
			<SettingsContent user={session.user} googleEnabled={googleEnabled} householdId={householdId} />
		</PageShell>
	);
}
