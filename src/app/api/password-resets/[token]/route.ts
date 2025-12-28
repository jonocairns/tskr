import { NextResponse } from "next/server";
import { z } from "zod";

import { hashPasswordResetToken } from "@/lib/passwordReset";
import { hashPassword } from "@/lib/passwords";
import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";

const requestSchema = z.object({
	password: z.string().min(8, "Password must be at least 8 characters"),
});

type Params = {
	params: Promise<{ token: string }>;
};

export async function POST(req: Request, { params }: Params) {
	const { token: rawToken } = await params;
	const token = rawToken?.trim();
	if (!token) {
		return NextResponse.json({ error: "Invalid token" }, { status: 400 });
	}
	const tokenHash = hashPasswordResetToken(token);

	const json = await req.json().catch(() => null);
	const parsed = requestSchema.safeParse(json);
	if (!parsed.success) {
		return NextResponse.json({ error: "Invalid payload", details: parsed.error.flatten() }, { status: 400 });
	}

	const resetToken = await prisma.passwordResetToken.findUnique({
		where: { tokenHash },
		select: {
			userId: true,
			expiresAt: true,
			usedAt: true,
		},
	});

	if (!resetToken || resetToken.usedAt || resetToken.expiresAt.getTime() < Date.now()) {
		return NextResponse.json({ error: "Invalid or expired token" }, { status: 400 });
	}

	const passwordHash = await hashPassword(parsed.data.password);
	const now = new Date();

	await prisma.$transaction([
		prisma.user.update({
			where: { id: resetToken.userId },
			data: { passwordHash, passwordResetRequired: false },
		}),
		prisma.passwordResetToken.updateMany({
			where: { userId: resetToken.userId, usedAt: null },
			data: { usedAt: now },
		}),
	]);

	return NextResponse.json({ ok: true });
}
