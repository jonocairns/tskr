import { createFileRoute, redirect } from "@tanstack/react-router";
import { createServerFn } from "@tanstack/react-start";
import { getRequestHeaders } from "@tanstack/react-start/server";

import { auth } from "@/auth/auth";
import { AssignedTasksManager } from "@/components/AssignedTasksManager";
import { AssignTaskCard } from "@/components/AssignTaskCard";
import { PageHeader } from "@/components/PageHeader";
import { PageShell } from "@/components/PageShell";
import { mapPresetSummaries } from "@/lib/dashboard/presets";
import { getHouseholdMembership } from "@/lib/households";
import { prisma } from "@/lib/prisma";

const loadAssignments = createServerFn({ method: "GET" })
	.inputValidator((data: { householdId: string }) => data)
	.handler(async ({ data: { householdId } }) => {
		const headers = getRequestHeaders();
		const session = await auth.api.getSession({ headers });

		if (!session?.user?.id) {
			throw redirect({ to: "/" });
		}

		const userId = session.user.id;
		const membership = await getHouseholdMembership(userId, householdId);

		if (!membership) {
			throw redirect({ to: "/landing" });
		}

		if (membership.role === "DOER") {
			throw redirect({ to: "/$householdId", params: { householdId } });
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

		return {
			session: {
				user: {
					id: session.user.id,
					name: session.user.name,
					email: session.user.email,
					image: session.user.image,
				},
			},
			userId,
			householdId,
			membership,
			members,
			presetSummaries,
			assignedTaskEntries,
		};
	});

export const Route = createFileRoute("/$householdId/_layout/assignments")({
	loader: ({ params }) => loadAssignments({ data: { householdId: params.householdId } }),
	component: AssignmentsPage,
});

function AssignmentsPage() {
	const data = Route.useLoaderData();

	return (
		<PageShell size="lg">
			<PageHeader
				eyebrow="tskr"
				title="Assignments"
				description="Assign tasks and adjust cadence or recurrence."
				backHref={`/${data.householdId}`}
				backLabel="Back to dashboard"
				user={data.session.user}
				household={{ id: data.householdId, role: data.membership.role }}
			/>

			<AssignTaskCard
				householdId={data.householdId}
				members={data.members}
				presets={data.presetSummaries}
				currentUserId={data.userId}
			/>

			<AssignedTasksManager householdId={data.householdId} initialTasks={data.assignedTaskEntries} />
		</PageShell>
	);
}
