import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";

import { AssignTaskCard } from "@/components/AssignTaskCard";
import { AssignedTasksManager } from "@/components/AssignedTasksManager";
import { AuthCta } from "@/components/AuthCta";
import { PageHeader } from "@/components/PageHeader";
import { authOptions } from "@/lib/auth";
import { mapPresetSummaries } from "@/lib/dashboard/presets";
import { getActiveHouseholdMembership } from "@/lib/households";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

export default async function AssignmentsPage() {
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
		redirect("/landing");
	}

	if (active.membership.role === "DOER") {
		redirect("/");
	}

	const { householdId } = active;

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
		<main className="min-h-screen bg-gradient-to-br from-background via-background to-muted">
			<div className="mx-auto flex max-w-5xl flex-col gap-6 px-4 py-10">
				<PageHeader
					eyebrow="tskr"
					title="Assignments"
					description="Assign tasks and adjust cadence or recurrence."
					backHref="/"
					backLabel="Back to dashboard"
					user={session.user}
				/>

				<AssignTaskCard
					members={members}
					presets={presetSummaries}
					currentUserId={userId}
				/>

				<AssignedTasksManager initialTasks={assignedTaskEntries} />
			</div>
		</main>
	);
}
