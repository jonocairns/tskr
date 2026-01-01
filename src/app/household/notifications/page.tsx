import { redirect } from "next/navigation";
import { getServerSession } from "next-auth";

import { AuthCta } from "@/components/AuthCta";
import { ReminderSettingsCard } from "@/components/household/ReminderSettingsCard";
import { UserReminderOverridesCard } from "@/components/household/UserReminderOverridesCard";
import { PageHeader } from "@/components/PageHeader";
import { PageShell } from "@/components/PageShell";
import { PushNotifications } from "@/components/PushNotifications";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/Card";
import { PushNotificationProvider } from "@/contexts/PushNotificationContext";
import { authOptions } from "@/lib/auth";
import { isGoogleAuthEnabled } from "@/lib/authConfig";
import { getActiveHouseholdMembership } from "@/lib/households";

export const dynamic = "force-dynamic";

export default async function NotificationsPage() {
	const googleEnabled = isGoogleAuthEnabled;
	const session = await getServerSession(authOptions);

	if (!session?.user?.id) {
		return (
			<PageShell layout="centered" size="lg">
				<AuthCta googleEnabled={googleEnabled} />
			</PageShell>
		);
	}

	const userId = session.user.id;
	const active = await getActiveHouseholdMembership(userId, session.user.householdId ?? null);
	if (!active) {
		redirect("/landing");
	}

	const { householdId, membership } = active;

	return (
		<PushNotificationProvider>
			<PageShell size="lg">
				<PageHeader
					eyebrow="tskr"
					title="Notifications"
					description="Manage push notifications and task reminders for your household."
					backHref="/household"
					backLabel="Back to settings"
					user={session.user}
					googleEnabled={googleEnabled}
				/>

				<Card>
					<CardHeader>
						<CardTitle className="text-xl">Push Notifications</CardTitle>
						<CardDescription>Enable browser notifications to receive alerts and reminders.</CardDescription>
					</CardHeader>
					<CardContent>
						<PushNotifications variant="section" />
					</CardContent>
				</Card>

				<Card>
					<CardHeader>
						<CardTitle className="text-xl">Task Reminders</CardTitle>
						<CardDescription>
							Configure when you want to receive reminders to complete tasks. Requires push notifications to be enabled.
						</CardDescription>
					</CardHeader>
					<CardContent className="space-y-8">
						{membership.role === "DICTATOR" && (
							<ReminderSettingsCard householdId={householdId} canManage={true} variant="section" />
						)}

						<UserReminderOverridesCard householdId={householdId} userId={userId} variant="section" />
					</CardContent>
				</Card>
			</PageShell>
		</PushNotificationProvider>
	);
}
