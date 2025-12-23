import { getServerSession } from "next-auth";
import { NextResponse } from "next/server";
import { z } from "zod";

import { authOptions } from "@/lib/auth";
import { DURATION_KEYS } from "@/lib/points";
import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";

type Params = {
	params: { id: string } | Promise<{ id: string }>;
};

const updateSchema = z
	.object({
		label: z
			.string()
			.trim()
			.min(2, "Name is too short")
			.max(50, "Keep the name short")
			.optional(),
		bucket: z.enum(DURATION_KEYS).optional(),
		isShared: z.boolean().optional(),
	})
	.refine((data) => Object.keys(data).length > 0, {
		message: "No updates provided",
	});

export async function PATCH(req: Request, { params }: Params) {
	const session = await getServerSession(authOptions);

	if (!session?.user?.id) {
		return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
	}

	const { id } = await Promise.resolve(params);
	if (!id) {
		return NextResponse.json({ error: "Missing preset id" }, { status: 400 });
	}

	const json = await req.json();
	const parsed = updateSchema.safeParse(json);

	if (!parsed.success) {
		return NextResponse.json(
			{ error: "Invalid payload", details: parsed.error.flatten() },
			{ status: 400 },
		);
	}

	const preset = await prisma.presetTask.findFirst({
		where: { id, createdById: session.user.id },
		select: { id: true },
	});

	if (!preset) {
		return NextResponse.json({ error: "Preset not found" }, { status: 404 });
	}

	const updated = await prisma.presetTask.update({
		where: { id },
		data: {
			label: parsed.data.label,
			bucket: parsed.data.bucket,
			isShared: parsed.data.isShared,
		},
		select: {
			id: true,
			label: true,
			bucket: true,
			isShared: true,
			createdById: true,
		},
	});

	return NextResponse.json({ preset: updated });
}

export async function DELETE(_req: Request, { params }: Params) {
	const session = await getServerSession(authOptions);

	if (!session?.user?.id) {
		return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
	}

	const { id } = await Promise.resolve(params);
	if (!id) {
		return NextResponse.json({ error: "Missing preset id" }, { status: 400 });
	}

	const preset = await prisma.presetTask.findFirst({
		where: { id, createdById: session.user.id },
		select: { id: true },
	});

	if (!preset) {
		return NextResponse.json({ error: "Preset not found" }, { status: 404 });
	}

	await prisma.presetTask.delete({ where: { id } });

	return NextResponse.json({ ok: true });
}
