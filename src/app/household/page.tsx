import { ChevronLeftIcon } from "lucide-react";
import Link from "next/link";
import { getServerSession } from "next-auth";

import { AuthCta } from "@/components/AuthCta";
import { HouseholdInvitesCard } from "@/components/HouseholdInvitesCard";
import { HouseholdJoinCard } from "@/components/HouseholdJoinCard";
import { HouseholdMembersCard } from "@/components/HouseholdMembersCard";
import { HouseholdSettingsCard } from "@/components/HouseholdSettingsCard";
import { HouseholdSwitcher } from "@/components/HouseholdSwitcher";
import { ModeToggle } from "@/components/ModeToggle";
import { PushNotifications } from "@/components/PushNotifications";
import { UserMenu } from "@/components/UserMenu";
import { Button } from "@/components/ui/Button";
import {
	Card,
	CardContent,
	CardDescription,
	CardHeader,
	CardTitle,
} from "@/components/ui/Card";
import { authOptions } from "@/lib/auth";
import { getActiveHouseholdMembership } from "@/lib/households";

export const dynamic = "force-dynamic";

export default async function HouseholdPage() {
	const session = await getServerSession(authOptions);

	if (!session?.user?.id) {
		return (
			<main className="flex min-h-screen items-center bg-gradient-to-br from-background via-background to-muted px-4 py-12">
				<AuthCta />
			</main>
		);
	}

	const userId = session.user.id;
	const active = await getActiveHouseholdMembership(
		userId,
		session.user.householdId ?? null,
	);
	if (!active) {
		return (
			<main className="flex min-h-screen items-center bg-gradient-to-br from-background via-background to-muted px-4 py-12">
				<p className="text-sm text-muted-foreground">
					Unable to load your household. Please try again.
				</p>
			</main>
		);
	}

	const { householdId, membership } = active;

	return (
		<main className="min-h-screen bg-gradient-to-br from-background via-background to-muted">
			<div className="mx-auto flex max-w-4xl flex-col gap-6 px-4 py-10">
				<header className="flex items-start justify-between">
					<div className="flex items-start gap-3">
						<Button asChild variant="ghost" size="icon">
							<Link href="/" aria-label="Back to dashboard">
								<ChevronLeftIcon className="h-5 w-5" />
							</Link>
						</Button>
						<div>
							<p className="text-xs font-semibold uppercase tracking-[0.2em] text-primary">
								tskr
							</p>
							<h1 className="text-3xl font-semibold tracking-tight">
								Household management
							</h1>
							<p className="text-sm text-muted-foreground">
								Manage settings, members, and invite codes.
							</p>
						</div>
					</div>
					<div className="flex items-center gap-2">
						<ModeToggle />
						<HouseholdSwitcher />
						<UserMenu user={session.user} />
					</div>
				</header>

				<HouseholdJoinCard />

				<Card>
					<CardHeader>
						<CardTitle className="text-xl">Household</CardTitle>
						<CardDescription>
							Update the name, manage members, and share invite codes.
						</CardDescription>
					</CardHeader>
					<CardContent className="space-y-8">
						<HouseholdSettingsCard
							householdId={householdId}
							canManage={membership.role === "DICTATOR"}
							variant="section"
						/>

						{membership.role !== "DOER" ? (
							<HouseholdMembersCard
								householdId={householdId}
								currentUserId={userId}
								canManageMembers={membership.role === "DICTATOR"}
								variant="section"
							/>
						) : null}

						<HouseholdInvitesCard
							householdId={householdId}
							canInvite={membership.role === "DICTATOR"}
							variant="section"
						/>
					</CardContent>
				</Card>

				<PushNotifications />
			</div>
		</main>
	);
}
