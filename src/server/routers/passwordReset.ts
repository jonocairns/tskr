import "server-only";

import { TRPCError } from "@trpc/server";
import { z } from "zod";

import { checkRateLimit } from "@/lib/loginRateLimit";
import { hashPasswordResetToken } from "@/lib/passwordReset";
import { hashPassword } from "@/lib/passwords";
import { prisma } from "@/lib/prisma";
import { publicProcedure, router } from "@/server/trpc";

const resetPasswordSchema = z.object({
	token: z.string().trim().min(1),
	password: z.string().min(8, "Password must be at least 8 characters"),
});

export const passwordResetRouter = router({
	reset: publicProcedure.input(resetPasswordSchema).mutation(async ({ input }) => {
		// Rate limiting - using a generic key since we don't have IP access easily in tRPC
		// In production, you might want to pass IP through context
		const rateKey = `password-reset:${input.token}`;
		if (!checkRateLimit(rateKey).ok) {
			throw new TRPCError({ code: "TOO_MANY_REQUESTS", message: "Too many requests" });
		}

		const tokenHash = hashPasswordResetToken(input.token);

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
