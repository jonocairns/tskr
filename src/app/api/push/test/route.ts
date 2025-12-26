import { getServerSession } from "next-auth";
import { NextResponse } from "next/server";

import { authOptions } from "@/lib/auth";
import { getActiveHouseholdMembership } from "@/lib/households";
import { broadcastPush, isPushConfigured } from "@/lib/push";

export const runtime = "nodejs";

export async function POST() {
	const session = await getServerSession(authOptions);

	if (!session?.user?.id) {
		return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
	}

	if (!isPushConfigured()) {
		return NextResponse.json(
			{ error: "Push is not configured" },
			{ status: 400 },
		);
	}

	const active = await getActiveHouseholdMembership(
		session.user.id,
		session.user.householdId ?? null,
	);
	if (!active) {
		return NextResponse.json({ error: "Household not found" }, { status: 403 });
	}

	await broadcastPush(
		{
			title: "tskr test notification",
			body: "This is a test push from tskr.",
			url: "/",
			icon: "/icon-192.png",
			badge: "/icon-192.png",
		},
		{ householdId: active.householdId },
	);

	return NextResponse.json({ ok: true });
}
