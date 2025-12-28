import { LogStatus } from "@prisma/client";
import { getServerSession } from "next-auth";
import { NextResponse } from "next/server";

import { computeAssignedTaskState } from "@/lib/assignedTasks";
import { authOptions } from "@/lib/auth";
import { getActiveHouseholdMembership } from "@/lib/households";
import { DURATION_KEYS, type DurationKey, getBucketPoints } from "@/lib/points";
import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";

type Params = {
	params: { id: string } | Promise<{ id: string }>;
};

const isDurationKey = (bucket: string): bucket is DurationKey =>
	DURATION_KEYS.includes(bucket as DurationKey);

export async function POST(_req: Request, { params }: Params) {
	const session = await getServerSession(authOptions);

	if (!session?.user?.id) {
		return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
	}

	const active = await getActiveHouseholdMembership(
		session.user.id,
		session.user.householdId ?? null,
	);
	if (!active) {
		return NextResponse.json({ error: "Household not found" }, { status: 403 });
	}

	const { id } = await Promise.resolve(params);
	if (!id) {
		return NextResponse.json(
			{ error: "Missing assigned task id" },
			{ status: 400 },
		);
	}

	const task = await prisma.assignedTask.findFirst({
		where: { id, householdId: active.householdId },
		select: {
			id: true,
			assignedToId: true,
			cadenceTarget: true,
			cadenceIntervalMinutes: true,
			isRecurring: true,
			status: true,
			preset: {
				select: { id: true, label: true, bucket: true, approvalOverride: true },
			},
		},
	});

	if (!task || !task.preset) {
		return NextResponse.json(
			{ error: "Assigned task not found" },
			{ status: 404 },
		);
	}

	if (task.assignedToId !== session.user.id) {
		return NextResponse.json({ error: "Forbidden" }, { status: 403 });
	}

	if (task.status !== "ACTIVE") {
		return NextResponse.json({ error: "Task is not active" }, { status: 400 });
	}

	const logs = await prisma.pointLog.findMany({
		where: {
			assignedTaskId: task.id,
			householdId: active.householdId,
			revertedAt: null,
			status: { in: [LogStatus.PENDING, LogStatus.APPROVED] },
		},
		select: { createdAt: true },
		orderBy: { createdAt: "asc" },
	});

	const state = computeAssignedTaskState(
		{
			cadenceTarget: task.cadenceTarget,
			cadenceIntervalMinutes: task.cadenceIntervalMinutes,
			isRecurring: task.isRecurring,
		},
		logs,
	);

	if (!state.isActive) {
		return NextResponse.json(
			{ error: "Task already completed for this cadence" },
			{ status: 400 },
		);
	}

	const resolveRequiresApproval = (override?: string | null) => {
		if (override === "REQUIRE") {
			return true;
		}
		if (override === "SKIP") {
			return false;
		}
		return active.membership.requiresApprovalDefault;
	};

	const bucket = isDurationKey(task.preset.bucket)
		? task.preset.bucket
		: "QUICK";
	const requiresApproval = resolveRequiresApproval(
		task.preset.approvalOverride,
	);
	const status = requiresApproval ? "PENDING" : "APPROVED";

	try {
		const entry = await prisma.pointLog.create({
			data: {
				householdId: active.householdId,
				userId: session.user.id,
				kind: "PRESET",
				duration: bucket,
				points: getBucketPoints(bucket),
				description: task.preset.label,
				presetId: task.preset.id,
				status,
				assignedTaskId: task.id,
			},
		});

		if (!task.isRecurring && status === "APPROVED") {
			const approvedCount = await prisma.pointLog.count({
				where: {
					assignedTaskId: task.id,
					householdId: active.householdId,
					revertedAt: null,
					status: LogStatus.APPROVED,
				},
			});
			if (approvedCount >= task.cadenceTarget) {
				await prisma.assignedTask.update({
					where: { id: task.id },
					data: { status: "COMPLETED" },
				});
			}
		}

		return NextResponse.json({ entry }, { status: 201 });
	} catch (error) {
		console.error("[assigned-tasks:complete]", error);
		return NextResponse.json(
			{ error: "Failed to complete task" },
			{ status: 500 },
		);
	}
}
