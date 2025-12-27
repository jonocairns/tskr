import { Prisma } from "@prisma/client";
import { getServerSession } from "next-auth";
import { NextResponse } from "next/server";
import { z } from "zod";

import { authOptions } from "@/lib/auth";
import { hashPassword } from "@/lib/passwords";
import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";

const createSchema = z.object({
	email: z.string().trim().email(),
	name: z.string().trim().max(80).nullable().optional(),
	password: z.string().min(8),
	passwordResetRequired: z.boolean().optional(),
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
	const parsed = createSchema.safeParse(json);
	if (!parsed.success) {
		return NextResponse.json(
			{ error: "Invalid payload", details: parsed.error.flatten() },
			{ status: 400 },
		);
	}

	const normalizedEmail = parsed.data.email.trim().toLowerCase();
	const name = parsed.data.name?.trim() ?? "";
	const passwordResetRequired = parsed.data.passwordResetRequired ?? true;

	try {
		const passwordHash = await hashPassword(parsed.data.password);
		const user = await prisma.user.create({
			data: {
				email: normalizedEmail,
				name: name.length > 0 ? name : null,
				passwordHash,
				passwordResetRequired,
				passwordLoginDisabled: false,
			},
			select: {
				id: true,
				name: true,
				email: true,
				createdAt: true,
				isSuperAdmin: true,
				passwordResetRequired: true,
				passwordLoginDisabled: true,
			},
		});

		return NextResponse.json(
			{
				user: {
					...user,
					createdAt: user.createdAt.toISOString(),
					hasGoogleAccount: false,
				},
			},
			{ status: 201 },
		);
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
			{ error: "Unable to create user" },
			{ status: 500 },
		);
	}
}
