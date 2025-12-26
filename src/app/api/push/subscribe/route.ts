import { getServerSession } from "next-auth";
import { NextResponse } from "next/server";
import { z } from "zod";

import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";

const subscriptionSchema = z.object({
	endpoint: z.string().url(),
	keys: z.object({
		p256dh: z.string(),
		auth: z.string(),
	}),
});

export async function POST(req: Request) {
	const session = await getServerSession(authOptions);

	if (!session?.user?.id) {
		return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
	}

	const json = await req.json().catch(() => null);
	const parsed = subscriptionSchema.safeParse(json);

	if (!parsed.success) {
		return NextResponse.json(
			{ error: "Invalid subscription" },
			{ status: 400 },
		);
	}

	const { endpoint, keys } = parsed.data;
	const userAgent = req.headers.get("user-agent") ?? undefined;

	const existing = await prisma.pushSubscription.findUnique({
		where: { endpoint },
		select: { userId: true },
	});
	if (existing && existing.userId !== session.user.id) {
		return NextResponse.json(
			{ error: "Subscription is registered to another user" },
			{ status: 403 },
		);
	}

	await prisma.pushSubscription.upsert({
		where: { endpoint },
		update: {
			userId: session.user.id,
			p256dh: keys.p256dh,
			auth: keys.auth,
			userAgent,
		},
		create: {
			userId: session.user.id,
			endpoint,
			p256dh: keys.p256dh,
			auth: keys.auth,
			userAgent,
		},
	});

	return NextResponse.json({ ok: true });
}

export async function DELETE(req: Request) {
	const session = await getServerSession(authOptions);

	if (!session?.user?.id) {
		return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
	}

	const json = await req.json().catch(() => null);
	const endpoint = typeof json?.endpoint === "string" ? json.endpoint : null;

	if (!endpoint) {
		return NextResponse.json({ error: "Missing endpoint" }, { status: 400 });
	}

	await prisma.pushSubscription.deleteMany({
		where: { endpoint, userId: session.user.id },
	});

	return NextResponse.json({ ok: true });
}
