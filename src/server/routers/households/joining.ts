import "server-only";

import { TRPCError } from "@trpc/server";
import { z } from "zod";

import { prisma } from "@/lib/prisma";
import { protectedProcedure, router } from "@/server/trpc";
import { config } from "@/server-config";

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

/**
 * Cleans up expired entries from the rate limit store to prevent unbounded memory growth.
 * This function removes all entries whose resetAt timestamp has passed.
 */
const cleanupExpiredEntries = () => {
	const now = Date.now();
	let removedCount = 0;

	for (const [key, entry] of rateLimitStore.entries()) {
		if (entry.resetAt <= now) {
			rateLimitStore.delete(key);
			removedCount++;
		}
	}

	if (removedCount > 0) {
		console.log(`[RateLimit] Cleaned up ${removedCount} expired rate limit entries`);
	}
};

// Run cleanup every 5 minutes to prevent memory leaks
// In production with multiple instances, consider using Redis instead
if (typeof setInterval !== "undefined") {
	setInterval(cleanupExpiredEntries, 5 * 60 * 1000);
}

const checkRateLimit = (key: string) => {
	const now = Date.now();
	const entry = rateLimitStore.get(key);
	if (!entry || entry.resetAt <= now) {
		const resetAt = now + config.joinRateLimitWindowMs;
		rateLimitStore.set(key, { count: 1, resetAt });
		return { ok: true, resetAt };
	}

	if (entry.count >= config.joinRateLimitMax) {
		return { ok: false, resetAt: entry.resetAt };
	}

	entry.count += 1;
	return { ok: true, resetAt: entry.resetAt };
};

const joinSchema = z.object({
	code: z.string().trim().min(4),
});

/**
 * Household joining router.
 * Handles joining households via invite codes with rate limiting.
 */
export const householdJoiningRouter = router({
	// Join household with invite code
	join: protectedProcedure.input(joinSchema).mutation(async ({ ctx, input }) => {
		const userId = ctx.session.user.id;

		// Rate limiting
		const rateKey = `join:${userId}`;
		const rateCheck = checkRateLimit(rateKey);
		if (!rateCheck.ok) {
			const retryAfterSeconds = Math.max(1, Math.ceil((rateCheck.resetAt - Date.now()) / 1000));
			throw new TRPCError({
				code: "TOO_MANY_REQUESTS",
				message: `Too many attempts, try again in ${retryAfterSeconds} seconds`,
			});
		}

		const code = input.code.trim().toUpperCase();
		const invite = await prisma.householdInvite.findFirst({
			where: { code, status: "PENDING" },
			select: { id: true, householdId: true, role: true, expiresAt: true },
		});

		if (!invite) {
			throw new TRPCError({ code: "NOT_FOUND", message: "Invalid invite code" });
		}

		const now = new Date();
		if (invite.expiresAt < now) {
			await prisma.householdInvite.update({
				where: { id: invite.id },
				data: { status: "EXPIRED", respondedAt: now },
			});
			throw new TRPCError({ code: "BAD_REQUEST", message: "Invite expired" });
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

		return { ok: true };
	}),
});
