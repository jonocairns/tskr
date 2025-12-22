import { getServerSession } from "next-auth";
import { NextResponse } from "next/server";

import { authOptions } from "@/lib/auth";
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

	await broadcastPush({
		title: "Taskr test notification",
		body: "This is a test push from Taskr.",
		url: "/",
		icon: "/icon-192.png",
		badge: "/icon-192.png",
	});

	return NextResponse.json({ ok: true });
}
