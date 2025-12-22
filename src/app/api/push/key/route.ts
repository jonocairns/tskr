import { NextResponse } from "next/server";

export const runtime = "nodejs";

export async function GET() {
	const publicKey = process.env.VAPID_PUBLIC_KEY;

	if (!publicKey) {
		return NextResponse.json(
			{ error: "Missing VAPID public key" },
			{ status: 404 },
		);
	}

	return NextResponse.json({ publicKey });
}
