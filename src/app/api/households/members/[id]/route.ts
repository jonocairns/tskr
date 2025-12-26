import { getServerSession } from "next-auth";
import { NextResponse } from "next/server";
import { z } from "zod";

import { authOptions } from "@/lib/auth";
import { getActiveHouseholdMembership } from "@/lib/households";
import { prisma } from "@/lib/prisma";

const updateSchema = z
	.object({
		role: z.enum(["DICTATOR", "APPROVER", "DOER"]).optional(),
		requiresApprovalDefault: z.boolean().optional(),
	})
	.refine((data) => Object.keys(data).length > 0, {
		message: "No updates provided",
	});

type Params = {
	params: { id: string } | Promise<{ id: string }>;
};

export async function PATCH(req: Request, { params }: Params) {
	const session = await getServerSession(authOptions);

	if (!session?.user?.id) {
		return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
	}

	const active = await getActiveHouseholdMembership(
		session.user.id,
		session.user.householdId ?? null,
	);
	if (!active) {
		return NextResponse.json({ error: "Household not found" }, { status: 403 });
	}

	if (active.membership.role !== "DICTATOR") {
		return NextResponse.json({ error: "Forbidden" }, { status: 403 });
	}

	const { id } = await Promise.resolve(params);
	if (!id) {
		return NextResponse.json({ error: "Missing member id" }, { status: 400 });
	}

	const json = await req.json().catch(() => null);
	const parsed = updateSchema.safeParse(json);
	if (!parsed.success) {
		return NextResponse.json(
			{ error: "Invalid payload", details: parsed.error.flatten() },
			{ status: 400 },
		);
	}

	const member = await prisma.householdMember.findFirst({
		where: { id, householdId: active.householdId },
		select: { id: true, role: true, userId: true },
	});

	if (!member) {
		return NextResponse.json({ error: "Member not found" }, { status: 404 });
	}

	if (
		parsed.data.role &&
		parsed.data.role !== member.role &&
		member.userId === session.user.id
	) {
		return NextResponse.json(
			{ error: "You cannot change your own role" },
			{ status: 400 },
		);
	}

	if (
		parsed.data.role &&
		parsed.data.role !== member.role &&
		member.role === "DICTATOR" &&
		parsed.data.role !== "DICTATOR"
	) {
		const dictatorCount = await prisma.householdMember.count({
			where: { householdId: active.householdId, role: "DICTATOR" },
		});
		if (dictatorCount <= 1) {
			return NextResponse.json(
				{ error: "Household must have at least one dictator" },
				{ status: 400 },
			);
		}
	}

	const updated = await prisma.householdMember.update({
		where: { id },
		data: {
			role: parsed.data.role,
			requiresApprovalDefault: parsed.data.requiresApprovalDefault,
		},
		select: {
			id: true,
			userId: true,
			role: true,
			requiresApprovalDefault: true,
		},
	});

	return NextResponse.json({ member: updated });
}
