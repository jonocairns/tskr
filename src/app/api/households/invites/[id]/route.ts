import { getServerSession } from "next-auth";
import { NextResponse } from "next/server";
import { z } from "zod";

import { authOptions } from "@/lib/auth";
import { getActiveHouseholdMembership } from "@/lib/households";
import { prisma } from "@/lib/prisma";
import { randomBytes } from "crypto";

const INVITE_EXPIRY_DAYS = 14;
const addExpiry = () => {
	const expiresAt = new Date();
	expiresAt.setDate(expiresAt.getDate() + INVITE_EXPIRY_DAYS);
	return expiresAt;
};

const actionSchema = z.object({
	action: z.enum(["revoke", "resend"]),
});

const generateCode = () => randomBytes(4).toString("hex").toUpperCase();

type Params = {
	params: { id: string } | Promise<{ id: string }>;
};

export async function PATCH(req: Request, { params }: Params) {
	const session = await getServerSession(authOptions);

	if (!session?.user?.id) {
		return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
	}

	const { id } = await Promise.resolve(params);
	if (!id) {
		return NextResponse.json({ error: "Missing invite id" }, { status: 400 });
	}

	const json = await req.json().catch(() => null);
	const parsed = actionSchema.safeParse(json);
	if (!parsed.success) {
		return NextResponse.json(
			{ error: "Invalid payload", details: parsed.error.flatten() },
			{ status: 400 },
		);
	}

	const invite = await prisma.householdInvite.findUnique({
		where: { id },
		select: {
			id: true,
			code: true,
			role: true,
			status: true,
			householdId: true,
		},
	});

	if (!invite) {
		return NextResponse.json({ error: "Invite not found" }, { status: 404 });
	}

	if (parsed.data.action === "resend") {
		const active = await getActiveHouseholdMembership(
			session.user.id,
			session.user.householdId ?? null,
		);
		if (!active || active.membership.role !== "DICTATOR") {
			return NextResponse.json({ error: "Forbidden" }, { status: 403 });
		}
		if (active.householdId !== invite.householdId) {
			return NextResponse.json({ error: "Forbidden" }, { status: 403 });
		}
		if (!["PENDING", "EXPIRED"].includes(invite.status)) {
			return NextResponse.json(
				{ error: "Invite cannot be resent" },
				{ status: 400 },
			);
		}

		let updated = null;
		let attempts = 0;
		while (!updated && attempts < 5) {
			attempts += 1;
			const code = generateCode();
			const existing = await prisma.householdInvite.findFirst({
				where: { code },
				select: { id: true },
			});
			if (existing) {
				continue;
			}
			updated = await prisma.householdInvite.update({
				where: { id },
				data: {
					code,
					status: "PENDING",
					invitedAt: new Date(),
					expiresAt: addExpiry(),
					respondedAt: null,
				},
				select: {
					id: true,
					code: true,
					role: true,
					status: true,
					invitedAt: true,
					expiresAt: true,
				},
			});
		}

		if (!updated) {
			return NextResponse.json(
				{ error: "Unable to regenerate invite code" },
				{ status: 500 },
			);
		}

		return NextResponse.json({ invite: updated });
	}

	if (parsed.data.action === "revoke") {
		const active = await getActiveHouseholdMembership(
			session.user.id,
			session.user.householdId ?? null,
		);
		if (!active || active.membership.role !== "DICTATOR") {
			return NextResponse.json({ error: "Forbidden" }, { status: 403 });
		}
		if (active.householdId !== invite.householdId) {
			return NextResponse.json({ error: "Forbidden" }, { status: 403 });
		}

		if (!["PENDING", "EXPIRED"].includes(invite.status)) {
			return NextResponse.json(
				{ error: "Invite cannot be revoked" },
				{ status: 400 },
			);
		}

		await prisma.householdInvite.update({
			where: { id },
			data: { status: "REVOKED", respondedAt: new Date() },
		});

		return NextResponse.json({ ok: true });
	}

	return NextResponse.json({ error: "Unsupported action" }, { status: 400 });
}
