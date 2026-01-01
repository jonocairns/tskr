import { redirect } from "next/navigation";
import { getServerSession } from "next-auth";

import { AssignedTasksManager } from "@/components/AssignedTasksManager";
import { AssignTaskCard } from "@/components/AssignTaskCard";
import { PageHeader } from "@/components/PageHeader";
import { PageShell } from "@/components/PageShell";
import { authOptions } from "@/lib/auth";
import { isGoogleAuthEnabled } from "@/lib/authConfig";
import { mapPresetSummaries } from "@/lib/dashboard/presets";
import { getHouseholdMembership } from "@/lib/households";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

type Props = {
	params: Promise<{ householdId: string }>;
};

export default async function AssignmentsPage({ params }: Props) {
	const googleEnabled = isGoogleAuthEnabled;
	const session = await getServerSession(authOptions);

	// Layout handles auth check - session will always exist here
	if (!session?.user?.id) {
		throw new Error("Unauthorized");
	}

	const userId = session.user.id;
	const { householdId } = await params;

	// Get membership for role info
	const membership = await getHouseholdMembership(userId, householdId);

	if (!membership) {
		throw new Error("Membership not found");
	}

	if (membership.role === "DOER") {
		redirect(`/${householdId}`);
	}

	const [members, presets, assignedTasks] = await Promise.all([
		prisma.user.findMany({
			where: { memberships: { some: { householdId } } },
			select: { id: true, name: true, email: true },
			orderBy: { createdAt: "asc" },
		}),
		prisma.presetTask.findMany({
			where: {
				householdId,
				OR: [{ isShared: true }, { createdById: userId }],
			},
			orderBy: [{ isShared: "desc" }, { createdAt: "asc" }],
			select: {
				id: true,
				label: true,
				bucket: true,
				isShared: true,
				createdById: true,
				approvalOverride: true,
				createdAt: true,
			},
		}),
		prisma.assignedTask.findMany({
			where: {
				householdId,
				status: "ACTIVE",
			},
			include: {
				assignedTo: { select: { id: true, name: true, email: true } },
				preset: { select: { id: true, label: true } },
			},
			orderBy: { assignedAt: "desc" },
		}),
	]);

	const presetSummaries = mapPresetSummaries(presets);
	const assignedTaskEntries = assignedTasks
		.filter((task) => Boolean(task.preset))
		.map((task) => ({
			id: task.id,
			presetLabel: task.preset?.label ?? "Task",
			assigneeId: task.assignedTo?.id ?? null,
			assigneeName: task.assignedTo?.name ?? null,
			assigneeEmail: task.assignedTo?.email ?? null,
			cadenceTarget: task.cadenceTarget,
			cadenceIntervalMinutes: task.cadenceIntervalMinutes,
			isRecurring: task.isRecurring,
			assignedAt: task.assignedAt.toISOString(),
		}));

	return (
		<PageShell size="lg">
			<PageHeader
				eyebrow="tskr"
				title="Assignments"
				description="Assign tasks and adjust cadence or recurrence."
				backHref={`/${householdId}`}
				backLabel="Back to dashboard"
				user={session.user}
				googleEnabled={googleEnabled}
			/>

			<AssignTaskCard members={members} presets={presetSummaries} currentUserId={userId} />

			<AssignedTasksManager initialTasks={assignedTaskEntries} />
		</PageShell>
	);
}
