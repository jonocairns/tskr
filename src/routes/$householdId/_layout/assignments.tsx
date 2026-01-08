import { createFileRoute, redirect } from "@tanstack/react-router";
import { createServerFn } from "@tanstack/react-start";

import { AssignedTasksManager } from "@/components/AssignedTasksManager";
import { AssignTaskCard } from "@/components/AssignTaskCard";
import { PageHeader } from "@/components/PageHeader";
import { PageShell } from "@/components/PageShell";
import { mapPresetSummaries } from "@/lib/dashboard/presets";
import type { HouseholdMembership } from "@/lib/households";
import { prisma } from "@/lib/prisma";

import type { HouseholdContext } from "../_layout";

const loadAssignments = createServerFn({ method: "GET" })
	.inputValidator(
		(data: {
			householdId: string;
			userId: string;
			membershipRole: HouseholdMembership["role"];
		}) => data,
	)
	.handler(async ({ data: { householdId, userId, membershipRole } }) => {
		// Authorization check - DOERs cannot access assignments page
		if (membershipRole === "DOER") {
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
			members,
			presetSummaries,
			assignedTaskEntries,
		};
	});

export const Route = createFileRoute("/$householdId/_layout/assignments")({
	loader: async ({ params, context }) => {
		const { householdContext } = context as { householdContext: HouseholdContext };
		const data = await loadAssignments({
			data: {
				householdId: params.householdId,
				userId: householdContext.userId,
				membershipRole: householdContext.membership.role,
			},
		});
		return { ...data, householdContext };
	},
	component: AssignmentsPage,
});

function AssignmentsPage() {
	const data = Route.useLoaderData();
	const { householdContext } = data;

	return (
		<PageShell size="lg">
			<PageHeader
				eyebrow="tskr"
				title="Assignments"
				description="Assign tasks and adjust cadence or recurrence."
				backHref={`/${householdContext.householdId}`}
				backLabel="Back to dashboard"
				user={householdContext.session.user}
				household={{ id: householdContext.householdId, role: householdContext.membership.role }}
			/>

			<AssignTaskCard
				householdId={householdContext.householdId}
				members={data.members}
				presets={data.presetSummaries}
				currentUserId={householdContext.userId}
			/>

			<AssignedTasksManager householdId={householdContext.householdId} initialTasks={data.assignedTaskEntries} />
		</PageShell>
	);
}
