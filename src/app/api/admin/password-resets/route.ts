import { getServerSession } from "next-auth";
import { NextResponse } from "next/server";
import { z } from "zod";

import { authOptions } from "@/lib/auth";
import { createPasswordResetToken } from "@/lib/passwordReset";
import { prisma } from "@/lib/prisma";
import { config } from "@/server-config";

export const runtime = "nodejs";

const requestSchema = z.object({
	email: z.string().trim().email(),
});

const deleteSchema = z.object({
	userId: z.string().trim().min(1),
});

export async function POST(req: Request) {
	const session = await getServerSession(authOptions);

	if (!session?.user?.id) {
		return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
	}

	if (!session.user.isSuperAdmin) {
		return NextResponse.json({ error: "Forbidden" }, { status: 403 });
	}

	const json = await req.json().catch(() => null);
	const parsed = requestSchema.safeParse(json);
	if (!parsed.success) {
		return NextResponse.json(
			{ error: "Invalid payload", details: parsed.error.flatten() },
			{ status: 400 },
		);
	}

	const email = parsed.data.email.trim().toLowerCase();
	const user = await prisma.user.findUnique({
		where: { email },
		select: { id: true, email: true, passwordLoginDisabled: true },
	});

	if (!user) {
		return NextResponse.json({ error: "User not found" }, { status: 404 });
	}

	if (user.passwordLoginDisabled) {
		return NextResponse.json(
			{ error: "Password login is disabled for this user" },
			{ status: 400 },
		);
	}

	const { token, expiresAt } = await createPasswordResetToken(user.id);

	const resetUrl = new URL(
		`/reset-password/${token}`,
		config.appUrl,
	).toString();

	return NextResponse.json({
		resetUrl,
		expiresAt: expiresAt.toISOString(),
	});
}

export async function DELETE(req: Request) {
	const session = await getServerSession(authOptions);

	if (!session?.user?.id) {
		return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
	}

	if (!session.user.isSuperAdmin) {
		return NextResponse.json({ error: "Forbidden" }, { status: 403 });
	}

	const json = await req.json().catch(() => null);
	const parsed = deleteSchema.safeParse(json);
	if (!parsed.success) {
		return NextResponse.json(
			{ error: "Invalid payload", details: parsed.error.flatten() },
			{ status: 400 },
		);
	}

	const user = await prisma.user.findUnique({
		where: { id: parsed.data.userId },
		select: { id: true },
	});

	if (!user) {
		return NextResponse.json({ error: "User not found" }, { status: 404 });
	}

	const result = await prisma.passwordResetToken.deleteMany({
		where: { userId: user.id },
	});

	return NextResponse.json({ deleted: result.count });
}
