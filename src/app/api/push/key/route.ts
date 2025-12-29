import { NextResponse } from "next/server";
import { config } from "@/server-config";

export const runtime = "nodejs";

export async function GET() {
	const publicKey = config.vapidPublicKey;

	if (!publicKey) {
		return NextResponse.json({ error: "Missing VAPID public key" }, { status: 404 });
	}

	return NextResponse.json({ publicKey });
}
