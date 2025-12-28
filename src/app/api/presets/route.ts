import { getServerSession } from "next-auth";
import { NextResponse } from "next/server";
import { z } from "zod";

import { authOptions } from "@/lib/auth";
import { getActiveHouseholdMembership } from "@/lib/households";
import { DURATION_KEYS } from "@/lib/points";
import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";

const presetSchema = z.object({
	label: z.string().trim().min(2, "Name is too short").max(50, "Keep the name short"),
	bucket: z.enum(DURATION_KEYS),
	isShared: z.boolean().optional(),
	approvalOverride: z.enum(["REQUIRE", "SKIP"]).nullable().optional(),
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

	const { householdId } = active;
	const presets = await prisma.presetTask.findMany({
		where: {
			householdId,
			OR: [{ isShared: true }, { createdById: session.user.id }],
		},
		orderBy: [{ isShared: "desc" }, { createdAt: "asc" }],
		select: {
			id: true,
			householdId: true,
			label: true,
			bucket: true,
			isShared: true,
			createdById: true,
			approvalOverride: true,
			createdAt: true,
		},
	});

	return NextResponse.json({ presets });
}

export async function POST(req: Request) {
	const session = await getServerSession(authOptions);

	if (!session?.user?.id) {
		return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
	}

	const active = await getActiveHouseholdMembership(session.user.id, session.user.householdId ?? null);
	if (!active) {
		return NextResponse.json({ error: "Household not found" }, { status: 403 });
	}

	const { householdId, membership } = active;
	const json = await req.json();
	const parsed = presetSchema.safeParse(json);

	if (!parsed.success) {
		return NextResponse.json({ error: "Invalid payload", details: parsed.error.flatten() }, { status: 400 });
	}

	const allowShared = membership.role !== "DOER";
	const approvalOverride = membership.role === "DOER" ? null : (parsed.data.approvalOverride ?? null);
	const preset = await prisma.presetTask.create({
		data: {
			householdId,
			createdById: session.user.id,
			label: parsed.data.label,
			bucket: parsed.data.bucket,
			isShared: allowShared ? (parsed.data.isShared ?? true) : false,
			approvalOverride,
		},
		select: {
			id: true,
			label: true,
			bucket: true,
			isShared: true,
			createdById: true,
			approvalOverride: true,
			createdAt: true,
		},
	});

	return NextResponse.json({ preset }, { status: 201 });
}
