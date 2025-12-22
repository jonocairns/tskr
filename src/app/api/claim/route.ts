import { getServerSession } from "next-auth";
import { NextResponse } from "next/server";

import { authOptions } from "@/lib/auth";
import { rewardThreshold } from "@/lib/points";
import { prisma } from "@/lib/prisma";

export async function POST() {
  const session = await getServerSession(authOptions);

  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const userId = session.user.id;
  const threshold = rewardThreshold();

  const total = await prisma.pointLog.aggregate({
    where: { userId, revertedAt: null },
    _sum: { points: true },
  });
  const available = total._sum.points ?? 0;

  if (available < threshold) {
    return NextResponse.json(
      { error: "Not enough points to claim", available, threshold },
      { status: 400 }
    );
  }

  try {
    const entry = await prisma.pointLog.create({
      data: {
        userId,
        kind: "REWARD",
        points: -threshold,
        rewardCost: threshold,
        description: "Reward claimed",
      },
    });

    return NextResponse.json({
      entry,
      remaining: available - threshold,
    });
  } catch (error) {
    console.error("[claim:POST]", error);
    return NextResponse.json(
      { error: "Unable to claim reward right now" },
      { status: 500 }
    );
  }
}
