import { getServerSession } from "next-auth";
import { NextResponse } from "next/server";

import { authOptions } from "@/lib/auth";
import { getActiveHouseholdMembership } from "@/lib/households";
import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";

export async function GET() {
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

	const members = await prisma.householdMember.findMany({
		where: { householdId: active.householdId },
		select: {
			id: true,
			userId: true,
			role: true,
			requiresApprovalDefault: true,
			joinedAt: true,
			user: { select: { name: true, email: true, image: true } },
		},
		orderBy: { joinedAt: "asc" },
	});

	return NextResponse.json({ members });
}
