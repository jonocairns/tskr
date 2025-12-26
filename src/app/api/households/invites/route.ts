import { getServerSession } from "next-auth";
import { NextResponse } from "next/server";
import { z } from "zod";

import { randomBytes } from "node:crypto";
import { authOptions } from "@/lib/auth";
import { getActiveHouseholdMembership } from "@/lib/households";
import { prisma } from "@/lib/prisma";

const INVITE_EXPIRY_DAYS = 14;
const addExpiry = () => {
	const expiresAt = new Date();
	expiresAt.setDate(expiresAt.getDate() + INVITE_EXPIRY_DAYS);
	return expiresAt;
};

const generateCode = () => randomBytes(4).toString("hex").toUpperCase();

export const runtime = "nodejs";

const inviteSchema = z.object({
	role: z.enum(["DICTATOR", "APPROVER", "DOER"]).optional(),
});

export async function GET() {
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

	const now = new Date();
	await prisma.householdInvite.updateMany({
		where: {
			householdId: active.householdId,
			status: "PENDING",
			expiresAt: { lt: now },
		},
		data: { status: "EXPIRED", respondedAt: now },
	});

	const invites = await prisma.householdInvite.findMany({
		where: {
			householdId: active.householdId,
			status: { in: ["PENDING", "EXPIRED"] },
		},
		select: {
			id: true,
			code: true,
			role: true,
			status: true,
			invitedAt: true,
			expiresAt: true,
			invitedBy: { select: { name: true, email: true } },
		},
		orderBy: { invitedAt: "desc" },
	});

	return NextResponse.json({ invites });
}

export async function POST(req: Request) {
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

	const json = await req.json().catch(() => null);
	const parsed = inviteSchema.safeParse(json);
	if (!parsed.success) {
		return NextResponse.json(
			{ error: "Invalid payload", details: parsed.error.flatten() },
			{ status: 400 },
		);
	}

	const role = parsed.data.role ?? "DOER";
	let invite = null;
	let attempts = 0;
	while (!invite && attempts < 5) {
		attempts += 1;
		const code = generateCode();
		const existing = await prisma.householdInvite.findFirst({
			where: { code },
			select: { id: true },
		});
		if (existing) {
			continue;
		}
		invite = await prisma.householdInvite.create({
			data: {
				householdId: active.householdId,
				code,
				role,
				invitedById: session.user.id,
				expiresAt: addExpiry(),
			},
			select: {
				id: true,
				code: true,
				role: true,
				status: true,
				invitedAt: true,
				expiresAt: true,
				invitedBy: { select: { name: true, email: true } },
			},
		});
	}

	if (!invite) {
		return NextResponse.json(
			{ error: "Unable to generate invite code" },
			{ status: 500 },
		);
	}

	return NextResponse.json({ invite }, { status: 201 });
}
