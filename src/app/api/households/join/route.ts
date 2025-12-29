import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { z } from "zod";

import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";

const JOIN_RATE_LIMIT_WINDOW_MS = 60_000;
const JOIN_RATE_LIMIT_MAX = 5;

type RateLimitEntry = {
	count: number;
	resetAt: number;
};

declare global {
	var joinRateLimit: Map<string, RateLimitEntry> | undefined;
}

const rateLimitStore = globalThis.joinRateLimit ?? new Map<string, RateLimitEntry>();

if (!globalThis.joinRateLimit) {
	globalThis.joinRateLimit = rateLimitStore;
}

const checkRateLimit = (key: string) => {
	const now = Date.now();
	const entry = rateLimitStore.get(key);
	if (!entry || entry.resetAt <= now) {
		const resetAt = now + JOIN_RATE_LIMIT_WINDOW_MS;
		rateLimitStore.set(key, { count: 1, resetAt });
		return { ok: true, resetAt };
	}

	if (entry.count >= JOIN_RATE_LIMIT_MAX) {
		return { ok: false, resetAt: entry.resetAt };
	}

	entry.count += 1;
	return { ok: true, resetAt: entry.resetAt };
};

const joinSchema = z.object({
	code: z.string().trim().min(4),
});

export async function POST(req: Request) {
	const session = await getServerSession(authOptions);

	if (!session?.user?.id) {
		return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
	}
	const userId = session.user.id;
	const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || req.headers.get("x-real-ip") || "unknown";
	const rateKey = `join:${userId}:${ip}`;
	const rateCheck = checkRateLimit(rateKey);
	if (!rateCheck.ok) {
		const retryAfterSeconds = Math.max(1, Math.ceil((rateCheck.resetAt - Date.now()) / 1000));
		const response = NextResponse.json({ error: "Too many attempts, try again soon" }, { status: 429 });
		response.headers.set("Retry-After", retryAfterSeconds.toString());
		return response;
	}

	const json = await req.json().catch(() => null);
	const parsed = joinSchema.safeParse(json);
	if (!parsed.success) {
		return NextResponse.json({ error: "Invalid payload", details: parsed.error.flatten() }, { status: 400 });
	}

	const code = parsed.data.code.trim().toUpperCase();
	const invite = await prisma.householdInvite.findFirst({
		where: { code, status: "PENDING" },
		select: { id: true, householdId: true, role: true, expiresAt: true },
	});

	if (!invite) {
		return NextResponse.json({ error: "Invalid invite code" }, { status: 404 });
	}

	const now = new Date();
	if (invite.expiresAt < now) {
		await prisma.householdInvite.update({
			where: { id: invite.id },
			data: { status: "EXPIRED", respondedAt: now },
		});
		return NextResponse.json({ error: "Invite expired" }, { status: 400 });
	}

	await prisma.$transaction(async (tx) => {
		await tx.householdMember.upsert({
			where: {
				householdId_userId: {
					householdId: invite.householdId,
					userId,
				},
			},
			update: {},
			create: {
				householdId: invite.householdId,
				userId,
				role: invite.role,
			},
		});

		await tx.householdInvite.update({
			where: { id: invite.id },
			data: { status: "ACCEPTED", respondedAt: now },
		});

		await tx.user.update({
			where: { id: userId },
			data: { lastHouseholdId: invite.householdId },
		});
	});

	return NextResponse.json({ ok: true });
}
