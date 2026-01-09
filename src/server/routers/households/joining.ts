import "server-only";

import { TRPCError } from "@trpc/server";
import { z } from "zod";

import { prisma } from "@/lib/prisma";
import { checkRateLimit } from "@/lib/rateLimit";
import { protectedProcedure, router } from "@/server/trpc";
import { config } from "@/server-config";

const joinSchema = z.object({
	code: z.string().trim().min(4),
});

export const householdJoiningRouter = router({
	join: protectedProcedure.input(joinSchema).mutation(async ({ ctx, input }) => {
		const userId = ctx.session.user.id;

		const rateKey = `join:${userId}`;
		const rateCheck = checkRateLimit(rateKey, config.joinRateLimitWindowMs, config.joinRateLimitMax);
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

		return { householdId: invite.householdId };
	}),
});
