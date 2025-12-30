import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";

import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";

export async function DELETE(_req: Request, { params }: { params: Promise<{ householdId: string }> }) {
	const session = await getServerSession(authOptions);

	if (!session?.user?.id) {
		return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
	}

	const resolvedParams = await params;

	if (!resolvedParams?.householdId) {
		return NextResponse.json({ error: "Household id is required" }, { status: 400 });
	}

	const membership = await prisma.householdMember.findFirst({
		where: { userId: session.user.id, householdId: resolvedParams.householdId },
		select: { role: true },
	});

	if (!membership || membership.role !== "DICTATOR") {
		return NextResponse.json({ error: "Forbidden" }, { status: 403 });
	}

	await prisma.$transaction(async (tx) => {
		await tx.user.updateMany({
			where: { lastHouseholdId: resolvedParams.householdId },
			data: { lastHouseholdId: null },
		});

		await tx.household.delete({
			where: { id: resolvedParams.householdId },
		});
	});

	return NextResponse.json({ ok: true });
}
