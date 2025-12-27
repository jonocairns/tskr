import { Prisma } from "@prisma/client";
import { getServerSession } from "next-auth";
import { NextResponse } from "next/server";
import { z } from "zod";

import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";

const updateSchema = z.object({
	email: z.string().trim().email().optional(),
	name: z.string().trim().max(80).nullable().optional(),
	passwordLoginDisabled: z.boolean().optional(),
	passwordResetRequired: z.boolean().optional(),
});

type Params = {
	params: Promise<{ id: string }>;
};

export async function PATCH(req: Request, { params }: Params) {
	const session = await getServerSession(authOptions);

	if (!session?.user?.id) {
		return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
	}

	if (!session.user.isSuperAdmin) {
		return NextResponse.json({ error: "Forbidden" }, { status: 403 });
	}

	const { id } = await params;
	if (!id) {
		return NextResponse.json({ error: "Invalid user" }, { status: 400 });
	}

	const json = await req.json().catch(() => null);
	const parsed = updateSchema.safeParse(json);
	if (!parsed.success) {
		return NextResponse.json(
			{ error: "Invalid payload", details: parsed.error.flatten() },
			{ status: 400 },
		);
	}

	if (
		parsed.data.email === undefined &&
		parsed.data.name === undefined &&
		parsed.data.passwordLoginDisabled === undefined &&
		parsed.data.passwordResetRequired === undefined
	) {
		return NextResponse.json({ error: "No updates provided" }, { status: 400 });
	}

	const data: {
		email?: string;
		name?: string | null;
		passwordLoginDisabled?: boolean;
		passwordResetRequired?: boolean;
	} = {};
	if (parsed.data.email !== undefined) {
		data.email = parsed.data.email.trim().toLowerCase();
	}
	if (parsed.data.name !== undefined) {
		const trimmedName = parsed.data.name?.trim() ?? "";
		data.name = trimmedName.length > 0 ? trimmedName : null;
	}
	if (parsed.data.passwordLoginDisabled !== undefined) {
		data.passwordLoginDisabled = parsed.data.passwordLoginDisabled;
	}
	if (parsed.data.passwordResetRequired !== undefined) {
		data.passwordResetRequired = parsed.data.passwordResetRequired;
	}

	if (data.passwordLoginDisabled === true) {
		const hasGoogleAccount = await prisma.account.findFirst({
			where: { userId: id, provider: "google" },
			select: { id: true },
		});

		if (!hasGoogleAccount) {
			return NextResponse.json(
				{ error: "Link Google before disabling password login" },
				{ status: 400 },
			);
		}

		data.passwordResetRequired = false;
	}

	try {
		const user = await prisma.user.update({
			where: { id },
			data,
			select: { id: true, name: true, email: true },
		});

		return NextResponse.json({ user });
	} catch (error) {
		if (
			error instanceof Prisma.PrismaClientKnownRequestError &&
			error.code === "P2002"
		) {
			return NextResponse.json(
				{ error: "Email already in use" },
				{ status: 409 },
			);
		}

		return NextResponse.json(
			{ error: "Unable to update user" },
			{ status: 500 },
		);
	}
}

export async function DELETE(req: Request, { params }: Params) {
	const session = await getServerSession(authOptions);

	if (!session?.user?.id) {
		return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
	}

	if (!session.user.isSuperAdmin) {
		return NextResponse.json({ error: "Forbidden" }, { status: 403 });
	}

	const { id } = await params;
	if (!id) {
		return NextResponse.json({ error: "Invalid user" }, { status: 400 });
	}

	if (session.user.id === id) {
		return NextResponse.json(
			{ error: "You cannot delete your own account" },
			{ status: 400 },
		);
	}

	await prisma.user.delete({ where: { id } });

	return NextResponse.json({ ok: true });
}
