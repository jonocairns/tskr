import { getServerSession } from "next-auth";
import { NextResponse } from "next/server";
import { z } from "zod";

import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";

const joinSchema = z.object({
	code: z.string().trim().min(4),
});

export async function POST(req: Request) {
	const session = await getServerSession(authOptions);

	if (!session?.user?.id) {
		return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
	}
	const userId = session.user.id;

	const json = await req.json().catch(() => null);
	const parsed = joinSchema.safeParse(json);
	if (!parsed.success) {
		return NextResponse.json(
			{ error: "Invalid payload", details: parsed.error.flatten() },
			{ status: 400 },
		);
	}

	const code = parsed.data.code.trim().toUpperCase();
	const invite = await prisma.householdInvite.findFirst({
		where: { code, status: "PENDING" },
		select: { id: true, householdId: true, role: true, expiresAt: true },
	});

	if (!invite) {
		return NextResponse.json({ error: "Invalid invite code" }, { status: 404 });
	}

	const now = new Date();
	if (invite.expiresAt < now) {
		await prisma.householdInvite.update({
			where: { id: invite.id },
			data: { status: "EXPIRED", respondedAt: now },
		});
		return NextResponse.json({ error: "Invite expired" }, { status: 400 });
	}

	await prisma.$transaction(async (tx) => {
		await tx.householdMember.upsert({
			where: {
				householdId_userId: {
					householdId: invite.householdId,
					userId,
				},
			},
			update: {},
			create: {
				householdId: invite.householdId,
				userId,
				role: invite.role,
			},
		});

		await tx.householdInvite.update({
			where: { id: invite.id },
			data: { status: "ACCEPTED", respondedAt: now },
		});

		await tx.user.update({
			where: { id: userId },
			data: { lastHouseholdId: invite.householdId },
		});
	});

	return NextResponse.json({ ok: true });
}
