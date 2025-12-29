import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { z } from "zod";

import { authOptions } from "@/lib/auth";
import { getActiveHouseholdMembership } from "@/lib/households";
import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";

const updateSchema = z.object({
	name: z.string().trim().min(2, "Name is too short").max(50, "Keep the name short"),
	rewardThreshold: z.number().int().min(1, "Threshold must be at least 1").max(10000, "Threshold is too high"),
	progressBarColor: z
		.string()
		.regex(/^#([0-9a-fA-F]{6})$/, "Color must be a 6-digit hex value")
		.nullable(),
});

export async function GET() {
	const session = await getServerSession(authOptions);

	if (!session?.user?.id) {
		return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
	}

	const active = await getActiveHouseholdMembership(session.user.id, session.user.householdId ?? null);
	if (!active) {
		return NextResponse.json({ error: "Household not found" }, { status: 403 });
	}

	const household = await prisma.household.findUnique({
		where: { id: active.householdId },
		select: {
			id: true,
			name: true,
			createdById: true,
			rewardThreshold: true,
			progressBarColor: true,
		},
	});

	if (!household) {
		return NextResponse.json({ error: "Household not found" }, { status: 404 });
	}

	return NextResponse.json({ household });
}

export async function PATCH(req: Request) {
	const session = await getServerSession(authOptions);

	if (!session?.user?.id) {
		return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
	}

	const active = await getActiveHouseholdMembership(session.user.id, session.user.householdId ?? null);
	if (!active) {
		return NextResponse.json({ error: "Household not found" }, { status: 403 });
	}

	if (active.membership.role !== "DICTATOR") {
		return NextResponse.json({ error: "Forbidden" }, { status: 403 });
	}

	const json = await req.json().catch(() => null);
	const parsed = updateSchema.partial().safeParse(json);
	if (!parsed.success) {
		return NextResponse.json({ error: "Invalid payload", details: parsed.error.flatten() }, { status: 400 });
	}
	if (!parsed.data.name && parsed.data.rewardThreshold === undefined && parsed.data.progressBarColor === undefined) {
		return NextResponse.json({ error: "No updates provided" }, { status: 400 });
	}

	const household = await prisma.household.update({
		where: { id: active.householdId },
		data: {
			...(parsed.data.name ? { name: parsed.data.name.trim() } : {}),
			...(parsed.data.rewardThreshold !== undefined ? { rewardThreshold: parsed.data.rewardThreshold } : {}),
			...(parsed.data.progressBarColor !== undefined ? { progressBarColor: parsed.data.progressBarColor } : {}),
		},
		select: {
			id: true,
			name: true,
			rewardThreshold: true,
			progressBarColor: true,
		},
	});

	return NextResponse.json({ household });
}

export async function DELETE() {
	const session = await getServerSession(authOptions);

	if (!session?.user?.id) {
		return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
	}

	const active = await getActiveHouseholdMembership(session.user.id, session.user.householdId ?? null);
	if (!active) {
		return NextResponse.json({ error: "Household not found" }, { status: 403 });
	}

	if (active.membership.role !== "DICTATOR") {
		return NextResponse.json({ error: "Forbidden" }, { status: 403 });
	}

	await prisma.$transaction(async (tx) => {
		await tx.user.updateMany({
			where: { lastHouseholdId: active.householdId },
			data: { lastHouseholdId: null },
		});

		await tx.household.delete({
			where: { id: active.householdId },
		});
	});

	return NextResponse.json({ ok: true });
}
