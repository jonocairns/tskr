import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";

import { authOptions } from "@/lib/auth";
import { getActiveHouseholdMembership } from "@/lib/households";
import { prisma } from "@/lib/prisma";

export async function POST() {
	const session = await getServerSession(authOptions);

	if (!session?.user?.id) {
		return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
	}

	const active = await getActiveHouseholdMembership(session.user.id, session.user.householdId ?? null);
	if (!active) {
		return NextResponse.json({ error: "Household not found" }, { status: 403 });
	}

	const userId = session.user.id;
	const { householdId } = active;
	try {
		const result = await prisma.$transaction(async (tx) => {
			const household = await tx.household.findUnique({
				where: { id: householdId },
				select: { rewardThreshold: true },
			});
			const threshold = household?.rewardThreshold ?? 50;

			const total = await tx.pointLog.aggregate({
				where: {
					userId,
					householdId,
					revertedAt: null,
					status: "APPROVED",
				},
				_sum: { points: true },
			});
			const available = total._sum.points ?? 0;

			if (available < threshold) {
				return { ok: false, available, threshold } as const;
			}

			const entry = await tx.pointLog.create({
				data: {
					householdId,
					userId,
					kind: "REWARD",
					points: -threshold,
					rewardCost: threshold,
					description: "Reward claimed",
				},
			});

			return {
				ok: true,
				entry,
				remaining: available - threshold,
			} as const;
		});

		if (!result.ok) {
			return NextResponse.json(
				{
					error: "Not enough points to claim",
					available: result.available,
					threshold: result.threshold,
				},
				{ status: 400 },
			);
		}

		return NextResponse.json({
			entry: result.entry,
			remaining: result.remaining,
		});
	} catch (error) {
		console.error("[claim:POST]", error);
		return NextResponse.json({ error: "Unable to claim reward right now" }, { status: 500 });
	}
}
