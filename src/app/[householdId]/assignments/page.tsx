import { redirect } from "next/navigation";

import { AssignedTasksManager } from "@/components/AssignedTasksManager";
import { AssignTaskCard } from "@/components/AssignTaskCard";
import { PageHeader } from "@/components/PageHeader";
import { PageShell } from "@/components/PageShell";
import { mapPresetSummaries } from "@/lib/dashboard/presets";
import { prisma } from "@/lib/prisma";
import { getHouseholdContext } from "@/lib/serverAuth";

export const dynamic = "force-dynamic";

type Props = {
	params: Promise<{ householdId: string }>;
};

export default async function AssignmentsPage({ params }: Props) {
	const { householdId } = await params;
	const { session, userId, membership } = await getHouseholdContext(householdId);

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
				household={{ id: householdId, role: membership.role }}
			/>

			<AssignTaskCard householdId={householdId} members={members} presets={presetSummaries} currentUserId={userId} />

			<AssignedTasksManager householdId={householdId} initialTasks={assignedTaskEntries} />
		</PageShell>
	);
}
