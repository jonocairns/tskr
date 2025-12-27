import { getServerSession } from "next-auth";
import { NextResponse } from "next/server";
import { z } from "zod";

import {
	getAppSettings,
	setAllowGoogleAccountCreation,
} from "@/lib/appSettings";
import { authOptions } from "@/lib/auth";

export const runtime = "nodejs";

const updateSchema = z.object({
	allowGoogleAccountCreation: z.boolean(),
});

export async function GET() {
	const session = await getServerSession(authOptions);

	if (!session?.user?.id) {
		return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
	}

	if (!session.user.isSuperAdmin) {
		return NextResponse.json({ error: "Forbidden" }, { status: 403 });
	}

	const settings = await getAppSettings();
	return NextResponse.json({ settings });
}

export async function PATCH(req: Request) {
	const session = await getServerSession(authOptions);

	if (!session?.user?.id) {
		return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
	}

	if (!session.user.isSuperAdmin) {
		return NextResponse.json({ error: "Forbidden" }, { status: 403 });
	}

	const json = await req.json().catch(() => null);
	const parsed = updateSchema.safeParse(json);
	if (!parsed.success) {
		return NextResponse.json(
			{ error: "Invalid payload", details: parsed.error.flatten() },
			{ status: 400 },
		);
	}

	const settings = await setAllowGoogleAccountCreation(
		parsed.data.allowGoogleAccountCreation,
	);

	return NextResponse.json({ settings });
}
