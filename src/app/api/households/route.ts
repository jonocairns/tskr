import { getServerSession } from "next-auth";
import { NextResponse } from "next/server";

import { authOptions } from "@/lib/auth";
import { ensureActiveHouseholdId } from "@/lib/households";
import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";

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

	if (!activeHouseholdId) {
		return NextResponse.json({ error: "Household not found" }, { status: 403 });
	}

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
		activeHouseholdId,
	});
}
