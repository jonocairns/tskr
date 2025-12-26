import { getServerSession } from "next-auth";
import { NextResponse } from "next/server";
import { z } from "zod";

import { authOptions } from "@/lib/auth";
import { ensureActiveHouseholdId } from "@/lib/households";
import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";

const createSchema = z.object({
	name: z.string().trim().min(2).max(50).optional(),
});

export async function GET() {
	const session = await getServerSession(authOptions);

	if (!session?.user?.id) {
		return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
	}

	const userId = session.user.id;
	const activeHouseholdId = await ensureActiveHouseholdId(
		userId,
		session.user.householdId ?? null,
	);

	const memberships = await prisma.householdMember.findMany({
		where: { userId },
		select: {
			householdId: true,
			role: true,
			joinedAt: true,
			household: { select: { name: true } },
		},
		orderBy: { joinedAt: "asc" },
	});

	const households = memberships.map((membership) => ({
		id: membership.householdId,
		name: membership.household.name,
		role: membership.role,
	}));

	return NextResponse.json({
		households,
		activeHouseholdId: activeHouseholdId ?? null,
	});
}

export async function POST(req: Request) {
	const session = await getServerSession(authOptions);

	if (!session?.user?.id) {
		return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
	}

	const json = await req.json().catch(() => null);
	const parsed = createSchema.safeParse(json);
	if (!parsed.success) {
		return NextResponse.json(
			{ error: "Invalid payload", details: parsed.error.flatten() },
			{ status: 400 },
		);
	}

	const userId = session.user.id;
	const defaultName = "My household";
	const name =
		parsed.data.name && parsed.data.name.trim().length >= 2
			? parsed.data.name.trim()
			: defaultName;

	const household = await prisma.household.create({
		data: {
			name,
			createdById: userId,
			members: {
				create: {
					userId,
					role: "DICTATOR",
					requiresApprovalDefault: false,
				},
			},
		},
		select: { id: true, name: true },
	});

	await prisma.user.update({
		where: { id: userId },
		data: { lastHouseholdId: household.id },
	});

	return NextResponse.json({ household }, { status: 201 });
}
