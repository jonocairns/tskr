import { getServerSession } from "next-auth";
import { NextResponse } from "next/server";
import { z } from "zod";

import { authOptions } from "@/lib/auth";
import { getActiveHouseholdMembership } from "@/lib/households";
import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";

const payloadSchema = z.object({
	presetId: z.string().min(1),
	assigneeId: z.string().min(1),
	cadenceTarget: z.number().int().min(1),
	cadenceIntervalMinutes: z.number().int().min(1),
	isRecurring: z.boolean(),
});

export async function POST(req: Request) {
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

	if (active.membership.role === "DOER") {
		return NextResponse.json({ error: "Forbidden" }, { status: 403 });
	}

	const json = await req.json().catch(() => null);
	const parsed = payloadSchema.safeParse(json);
	if (!parsed.success) {
		return NextResponse.json(
			{ error: "Invalid payload", details: parsed.error.flatten() },
			{ status: 400 },
		);
	}

	const {
		presetId,
		assigneeId,
		cadenceTarget,
		cadenceIntervalMinutes,
		isRecurring,
	} = parsed.data;
	const normalizedCadenceTarget = isRecurring ? cadenceTarget : 1;
	const normalizedCadenceIntervalMinutes = Math.max(1, cadenceIntervalMinutes);

	const member = await prisma.householdMember.findFirst({
		where: { householdId: active.householdId, userId: assigneeId },
		select: { id: true },
	});

	if (!member) {
		return NextResponse.json(
			{ error: "Assignee not found in household" },
			{ status: 400 },
		);
	}

	const preset = await prisma.presetTask.findFirst({
		where: { id: presetId, householdId: active.householdId },
		select: { id: true },
	});

	if (!preset) {
		return NextResponse.json({ error: "Preset not found" }, { status: 400 });
	}

	try {
		const assignedTask = await prisma.assignedTask.create({
			data: {
				householdId: active.householdId,
				presetId: preset.id,
				assignedToId: assigneeId,
				assignedById: session.user.id,
				cadenceTarget: normalizedCadenceTarget,
				cadenceIntervalMinutes: normalizedCadenceIntervalMinutes,
				isRecurring,
				status: "ACTIVE",
			},
		});

		return NextResponse.json({ assignedTask }, { status: 201 });
	} catch (error) {
		console.error("[assigned-tasks:POST]", error);
		return NextResponse.json(
			{ error: "Failed to assign task" },
			{ status: 500 },
		);
	}
}
