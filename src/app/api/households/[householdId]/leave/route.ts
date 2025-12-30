import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";

import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function POST(_req: Request, { params }: { params: Promise<{ householdId: string }> }) {
	const session = await getServerSession(authOptions);

	if (!session?.user?.id) {
		return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
	}

	const resolvedParams = await params;

	if (!resolvedParams?.householdId) {
		return NextResponse.json({ error: "Household id is required" }, { status: 400 });
	}

	const userId = session.user.id;
	const householdId = resolvedParams.householdId;

	const membership = await prisma.householdMember.findFirst({
		where: { userId, householdId },
		select: { role: true },
	});

	if (!membership) {
		return NextResponse.json({ error: "Forbidden" }, { status: 403 });
	}

	const dictatorCount = await prisma.householdMember.count({
		where: { householdId, role: "DICTATOR" },
	});

	const isLastDictator = membership.role === "DICTATOR" && dictatorCount <= 1;

	if (isLastDictator) {
		await prisma.$transaction(async (tx) => {
			await tx.user.updateMany({
				where: { lastHouseholdId: householdId },
				data: { lastHouseholdId: null },
			});

			await tx.household.delete({
				where: { id: householdId },
			});
		});

		return NextResponse.json({ deleted: true });
	}

	await prisma.$transaction(async (tx) => {
		const user = await tx.user.findUnique({
			where: { id: userId },
			select: { lastHouseholdId: true },
		});

		await tx.householdMember.delete({
			where: { householdId_userId: { householdId, userId } },
		});

		if (user?.lastHouseholdId === householdId) {
			const fallback = await tx.householdMember.findFirst({
				where: { userId },
				select: { householdId: true },
				orderBy: { joinedAt: "asc" },
			});

			await tx.user.update({
				where: { id: userId },
				data: { lastHouseholdId: fallback?.householdId ?? null },
			});
		}
	});

	return NextResponse.json({ deleted: false });
}
