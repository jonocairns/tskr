import { getServerSession } from "next-auth";
import { NextResponse } from "next/server";
import { z } from "zod";

import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

const selectionSchema = z.object({
	householdId: z.string().min(1),
});

export async function POST(req: Request) {
	const session = await getServerSession(authOptions);

	if (!session?.user?.id) {
		return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
	}

	const json = await req.json().catch(() => null);
	const parsed = selectionSchema.safeParse(json);
	if (!parsed.success) {
		return NextResponse.json(
			{ error: "Invalid payload", details: parsed.error.flatten() },
			{ status: 400 },
		);
	}

	const { householdId } = parsed.data;
	const membership = await prisma.householdMember.findFirst({
		where: { userId: session.user.id, householdId },
		select: { householdId: true },
	});

	if (!membership) {
		return NextResponse.json({ error: "Forbidden" }, { status: 403 });
	}

	await prisma.user.update({
		where: { id: session.user.id },
		data: { lastHouseholdId: householdId },
	});

	return NextResponse.json({ ok: true });
}
