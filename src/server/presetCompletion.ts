import "server-only";

import type { AssignedTask, PresetTask } from "@prisma/client";
import { TRPCError } from "@trpc/server";
import { getServerT } from "@/lib/i18nServer";
import { DURATION_KEYS, type DurationKey, getBucketPoints } from "@/lib/points";
import type { prisma } from "@/lib/prisma";
import { broadcastPush, isPushConfigured } from "@/lib/push";
import { getAssignedTaskStatus } from "@/server/assignedTaskState";

type TransactionClient = Parameters<Parameters<typeof prisma.$transaction>[0]>[0];
type CompletionPreset = Pick<PresetTask, "id" | "label" | "bucket" | "approvalOverride">;
type CompletionTask = Pick<AssignedTask, "id" | "isRecurring" | "cadenceTarget">;

export const writePresetCompletion = async (
	tx: TransactionClient,
	{
		householdId,
		userId,
		preset,
		task,
		at,
		description,
	}: {
		householdId: string;
		userId: string;
		preset: CompletionPreset;
		task: CompletionTask | null;
		at: Date;
		description?: string;
	},
) => {
	const membership = await tx.householdMember.findUnique({
		where: { householdId_userId: { householdId, userId } },
		select: { requiresApprovalDefault: true },
	});
	if (!membership) throw new TRPCError({ code: "FORBIDDEN", message: "Household membership not found" });
	const bucket = DURATION_KEYS.includes(preset.bucket as DurationKey) ? (preset.bucket as DurationKey) : "QUICK";
	const override = preset.approvalOverride;
	const requiresApproval = override === "REQUIRE" || (override !== "SKIP" && membership.requiresApprovalDefault);
	const status = requiresApproval ? "PENDING" : "APPROVED";
	const entry = await tx.pointLog.create({
		data: {
			householdId,
			userId,
			kind: "PRESET",
			duration: bucket,
			points: getBucketPoints(bucket),
			description: description?.trim() || preset.label,
			presetId: preset.id,
			status,
			assignedTaskId: task?.id ?? null,
			createdAt: at,
		},
	});
	if (task && !task.isRecurring && status === "APPROVED") {
		await tx.assignedTask.update({
			where: { id: task.id },
			data: { status: await getAssignedTaskStatus(tx, task, householdId) },
		});
	}
	return entry;
};

export const notifyTaskCompleted = async ({
	householdId,
	user,
	entry,
	task,
}: {
	householdId: string;
	user: { id: string; name?: string | null; email?: string | null; language?: string | null };
	entry: { status: string };
	task: {
		assignedToId: string | null;
		assignedTo: { name: string | null; email: string | null } | null;
		preset: { label: string };
	};
}) => {
	const userId = user.id;
	if (isPushConfigured()) {
		try {
			const t = await getServerT(user.language ?? undefined);
			const actor = user.name ?? user.email ?? t("Someone");
			const params = { actor, task: task.preset.label, assignee: task.assignedTo?.name ?? task.assignedTo?.email };
			const body =
				task.assignedToId !== userId && params.assignee
					? entry.status === "PENDING"
						? t("{{actor}} completed {{assignee}}'s {{task}}, awaiting approval", params)
						: t("{{actor}} completed {{assignee}}'s {{task}}", params)
					: entry.status === "PENDING"
						? t("{{actor}} completed {{task}}, awaiting approval", params)
						: t("{{actor}} completed {{task}}", params);
			await broadcastPush(
				{ title: t("Task completed"), body, url: "/", icon: "/icon-192.png", badge: "/icon-192.png" },
				{ householdId, excludeUserId: userId },
			);
		} catch (error) {
			console.error("[push] notify failed", error);
		}
	}
};
