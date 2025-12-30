import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { z } from "zod";

import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

const transferSchema = z.object({
	memberId: z.string().min(1),
});

export async function POST(req: Request, { params }: { params: Promise<{ householdId: string }> }) {
	const session = await getServerSession(authOptions);

	if (!session?.user?.id) {
		return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
	}

	const resolvedParams = await params;

	const json = await req.json().catch(() => null);
	const parsed = transferSchema.safeParse(json);
	if (!parsed.success) {
		return NextResponse.json({ error: "Invalid payload", details: parsed.error.flatten() }, { status: 400 });
	}

	const householdId = resolvedParams.householdId;
	const userId = session.user.id;

	const membership = await prisma.householdMember.findFirst({
		where: { userId, householdId },
		select: { role: true },
	});

	if (!membership || membership.role !== "DICTATOR") {
		return NextResponse.json({ error: "Forbidden" }, { status: 403 });
	}

	const target = await prisma.householdMember.findFirst({
		where: { id: parsed.data.memberId, householdId },
		select: { id: true, userId: true, role: true },
	});

	if (!target) {
		return NextResponse.json({ error: "Member not found" }, { status: 404 });
	}

	if (target.userId === userId) {
		return NextResponse.json({ error: "Select another member" }, { status: 400 });
	}

	await prisma.$transaction(async (tx) => {
		await tx.household.update({
			where: { id: householdId },
			data: { createdById: target.userId },
		});

		if (target.role !== "DICTATOR") {
			await tx.householdMember.update({
				where: { id: target.id },
				data: { role: "DICTATOR" },
			});
		}
	});

	return NextResponse.json({ ok: true });
}
