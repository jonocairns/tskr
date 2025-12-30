import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";

import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function GET(_req: Request, { params }: { params: Promise<{ householdId: string }> }) {
	const session = await getServerSession(authOptions);

	if (!session?.user?.id) {
		return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
	}

	const resolvedParams = await params;

	const membership = await prisma.householdMember.findFirst({
		where: { userId: session.user.id, householdId: resolvedParams.householdId },
		select: { role: true },
	});

	if (!membership) {
		return NextResponse.json({ error: "Forbidden" }, { status: 403 });
	}

	if (membership.role !== "DICTATOR") {
		return NextResponse.json({ error: "Forbidden" }, { status: 403 });
	}

	const members = await prisma.householdMember.findMany({
		where: { householdId: resolvedParams.householdId },
		select: {
			id: true,
			userId: true,
			role: true,
			user: { select: { name: true, email: true } },
		},
		orderBy: { joinedAt: "asc" },
	});

	return NextResponse.json({ members });
}
