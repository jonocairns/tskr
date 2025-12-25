import { getServerSession } from "next-auth";
import { NextResponse } from "next/server";
import { z } from "zod";

import { authOptions } from "@/lib/auth";
import { DURATION_KEYS } from "@/lib/points";
import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";

const presetSchema = z.object({
	label: z
		.string()
		.trim()
		.min(2, "Name is too short")
		.max(50, "Keep the name short"),
	bucket: z.enum(DURATION_KEYS),
	isShared: z.boolean().optional(),
});

export async function GET() {
	const session = await getServerSession(authOptions);

	if (!session?.user?.id) {
		return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
	}

	const presets = await prisma.presetTask.findMany({
		where: {
			OR: [{ isShared: true }, { createdById: session.user.id }],
		},
		orderBy: [{ isShared: "desc" }, { createdAt: "asc" }],
		select: {
			id: true,
			label: true,
			bucket: true,
			isShared: true,
			createdById: true,
			createdAt: true,
		},
	});

	return NextResponse.json({ presets });
}

export async function POST(req: Request) {
	const session = await getServerSession(authOptions);

	if (!session?.user?.id) {
		return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
	}

	const json = await req.json();
	const parsed = presetSchema.safeParse(json);

	if (!parsed.success) {
		return NextResponse.json(
			{ error: "Invalid payload", details: parsed.error.flatten() },
			{ status: 400 },
		);
	}

	const preset = await prisma.presetTask.create({
		data: {
			createdById: session.user.id,
			label: parsed.data.label,
			bucket: parsed.data.bucket,
			isShared: parsed.data.isShared ?? true,
		},
		select: {
			id: true,
			label: true,
			bucket: true,
			isShared: true,
			createdById: true,
			createdAt: true,
		},
	});

	return NextResponse.json({ preset }, { status: 201 });
}
