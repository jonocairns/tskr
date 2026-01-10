import "server-only";

import { TRPCError } from "@trpc/server";
import { z } from "zod";
import { hashPasswordResetToken } from "@/lib/passwordReset";
import { hashPassword } from "@/lib/passwords";
import { prisma } from "@/lib/prisma";
import { checkRateLimit, getClientIp } from "@/lib/rateLimit";
import { publicProcedure, router } from "@/server/trpc";

const resetPasswordSchema = z.object({
	token: z.string().trim().min(1),
	password: z.string().min(8, "Password must be at least 8 characters"),
});

export const passwordResetRouter = router({
	reset: publicProcedure.input(resetPasswordSchema).mutation(async ({ input, ctx }) => {
		const tokenHash = hashPasswordResetToken(input.token);
		const clientIp = getClientIp(ctx.req);

		// Apply rate limiting on multiple dimensions to prevent abuse:
		// 1. Per-token: prevents brute force attacks on a specific reset token (5 per 10 min)
		// 2. Per-IP: prevents a single attacker from trying many tokens (10 per 10 min)
		// 3. Global fallback: prevents abuse when IP is unavailable (20 per 10 min globally)
		const tokenRateCheck = checkRateLimit({
			key: `password-reset:token:${tokenHash}`,
			windowMs: 10 * 60_000,
			max: 5,
		});
		if (!tokenRateCheck.ok) {
			throw new TRPCError({ code: "TOO_MANY_REQUESTS", message: "Too many requests" });
		}

		if (clientIp) {
			const ipRateCheck = checkRateLimit({
				key: `password-reset:ip:${clientIp}`,
				windowMs: 10 * 60_000,
				max: 10,
			});
			if (!ipRateCheck.ok) {
				throw new TRPCError({ code: "TOO_MANY_REQUESTS", message: "Too many requests" });
			}
		} else {
			// If no IP is available, apply stricter global rate limiting
			// This prevents abuse from attackers without IP detection
			const globalRateCheck = checkRateLimit({
				key: "password-reset:global",
				windowMs: 10 * 60_000,
				max: 20,
			});
			if (!globalRateCheck.ok) {
				throw new TRPCError({ code: "TOO_MANY_REQUESTS", message: "Too many requests" });
			}
		}

		const resetToken = await prisma.passwordResetToken.findUnique({
			where: { tokenHash },
			select: {
				userId: true,
				expiresAt: true,
				usedAt: true,
				user: {
					select: {
						email: true,
					},
				},
			},
		});

		if (!resetToken || resetToken.usedAt || resetToken.expiresAt.getTime() < Date.now()) {
			throw new TRPCError({ code: "BAD_REQUEST", message: "Invalid or expired token" });
		}

		const passwordHash = await hashPassword(input.password);
		const now = new Date();

		await prisma.$transaction([
			prisma.user.update({
				where: { id: resetToken.userId },
				data: { passwordHash, passwordResetRequired: false },
			}),
			prisma.passwordResetToken.updateMany({
				where: { userId: resetToken.userId, usedAt: null },
				data: { usedAt: now },
			}),
			prisma.session.deleteMany({
				where: { userId: resetToken.userId },
			}),
		]);

		return { ok: true, email: resetToken.user.email };
	}),
});
