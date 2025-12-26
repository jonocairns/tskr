import { getServerSession } from "next-auth";
import { NextResponse } from "next/server";
import { z } from "zod";

import { authOptions } from "@/lib/auth";
import { getActiveHouseholdMembership } from "@/lib/households";
import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";

type Params = {
	params: { id: string } | Promise<{ id: string }>;
};

const payloadSchema = z
	.object({
		cadenceTarget: z.number().int().min(1).optional(),
		cadenceIntervalMinutes: z.number().int().min(1).optional(),
		isRecurring: z.boolean().optional(),
	})
	.refine(
		(data) =>
			data.cadenceTarget !== undefined ||
			data.cadenceIntervalMinutes !== undefined ||
			data.isRecurring !== undefined,
		{ message: "No updates provided" },
	);

export async function PATCH(req: Request, { params }: Params) {
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

	const { id } = await Promise.resolve(params);
	if (!id) {
		return NextResponse.json(
			{ error: "Missing assigned task id" },
			{ status: 400 },
		);
	}

	const json = await req.json().catch(() => null);
	const parsed = payloadSchema.safeParse(json);
	if (!parsed.success) {
		return NextResponse.json(
			{ error: "Invalid payload", details: parsed.error.flatten() },
			{ status: 400 },
		);
	}

	const task = await prisma.assignedTask.findFirst({
		where: { id, householdId: active.householdId },
		select: {
			id: true,
			cadenceIntervalMinutes: true,
		},
	});

	if (!task) {
		return NextResponse.json(
			{ error: "Assigned task not found" },
			{ status: 404 },
		);
	}

	try {
		const cadenceIntervalMinutes =
			parsed.data.cadenceIntervalMinutes ?? task.cadenceIntervalMinutes;
		const assignedTask = await prisma.assignedTask.update({
			where: { id },
			data: {
				isRecurring: parsed.data.isRecurring,
				cadenceTarget:
					parsed.data.isRecurring === false
						? 1
						: parsed.data.cadenceTarget,
				cadenceIntervalMinutes,
			},
		});

		return NextResponse.json({ assignedTask });
	} catch (error) {
		console.error("[assigned-tasks:PATCH]", error);
		return NextResponse.json(
			{ error: "Failed to update assigned task" },
			{ status: 500 },
		);
	}
}

export async function DELETE(_req: Request, { params }: Params) {
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

	const { id } = await Promise.resolve(params);
	if (!id) {
		return NextResponse.json(
			{ error: "Missing assigned task id" },
			{ status: 400 },
		);
	}

	const task = await prisma.assignedTask.findFirst({
		where: { id, householdId: active.householdId },
		select: { id: true },
	});

	if (!task) {
		return NextResponse.json(
			{ error: "Assigned task not found" },
			{ status: 404 },
		);
	}

	try {
		await prisma.assignedTask.delete({ where: { id } });
		return NextResponse.json({ ok: true });
	} catch (error) {
		console.error("[assigned-tasks:DELETE]", error);
		return NextResponse.json(
			{ error: "Failed to delete assigned task" },
			{ status: 500 },
		);
	}
}
