import { TRPCError } from "@trpc/server";
import { z } from "zod";

import { checkRateLimit } from "@/lib/loginRateLimit";
import { hashPasswordResetToken } from "@/lib/passwordReset";
import { hashPassword } from "@/lib/passwords";
import { prisma } from "@/lib/prisma";
import { protectedProcedure, publicProcedure, router } from "@/server/trpc";

const resetPasswordSchema = z.object({
	token: z.string().trim().min(1),
	password: z.string().min(8, "Password must be at least 8 characters"),
});

const resetAuthedSchema = z.object({
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
			// Update the credential account's password and clear reset flag
			prisma.account.updateMany({
				where: { userId: resetToken.userId, providerId: "credential" },
				data: { password: passwordHash, passwordResetRequired: false },
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

	resetAuthed: protectedProcedure.input(resetAuthedSchema).mutation(async ({ ctx, input }) => {
		const userId = ctx.session.user.id;

		const account = await prisma.account.findFirst({
			where: { userId, providerId: "credential" },
			select: { passwordResetRequired: true, disabled: true },
		});

		if (!account) {
			throw new TRPCError({ code: "BAD_REQUEST", message: "User has no credential account" });
		}

		if (account.disabled) {
			throw new TRPCError({ code: "BAD_REQUEST", message: "Password login is disabled for this user" });
		}

		if (!account.passwordResetRequired) {
			throw new TRPCError({ code: "BAD_REQUEST", message: "Password reset is not required" });
		}

		const user = await prisma.user.findUnique({
			where: { id: userId },
			select: { email: true },
		});

		const passwordHash = await hashPassword(input.password);

		await prisma.$transaction([
			prisma.account.updateMany({
				where: { userId, providerId: "credential" },
				data: { password: passwordHash, passwordResetRequired: false },
			}),
			prisma.passwordResetToken.deleteMany({
				where: { userId },
			}),
			prisma.session.deleteMany({
				where: { userId },
			}),
		]);

		return { ok: true, email: user?.email ?? null };
	}),
});
