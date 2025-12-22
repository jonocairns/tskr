import { getServerSession } from "next-auth";
import { NextResponse } from "next/server";

import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

type Params = {
	params: { id: string } | Promise<{ id: string }>;
};

export async function PATCH(_req: Request, { params }: Params) {
	const session = await getServerSession(authOptions);

	if (!session?.user?.id) {
		return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
	}

	const { id } = await Promise.resolve(params);

	if (!id) {
		return NextResponse.json({ error: "Missing log id" }, { status: 400 });
	}

	const log = await prisma.pointLog.findUnique({
		where: { id },
		select: { id: true, userId: true, revertedAt: true },
	});

	if (!log) {
		return NextResponse.json({ error: "Log not found" }, { status: 404 });
	}

	if (log.revertedAt) {
		return NextResponse.json({ error: "Already reverted" }, { status: 400 });
	}

	await prisma.pointLog.update({
		where: { id },
		data: {
			revertedAt: new Date(),
			revertedById: session.user.id,
		},
	});

	return NextResponse.json({ ok: true });
}
