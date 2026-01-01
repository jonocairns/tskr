import "server-only";

import { Prisma } from "@prisma/client";
import { TRPCError } from "@trpc/server";
import { z } from "zod";

import { getAppSettings, setAllowGoogleAccountCreation } from "@/lib/appSettings";
import { isGoogleAuthEnabled } from "@/lib/authConfig";
import { createPasswordResetToken } from "@/lib/passwordReset";
import { hashPassword } from "@/lib/passwords";
import { prisma } from "@/lib/prisma";
import { router, superAdminProcedure } from "@/server/trpc";
import { config } from "@/server-config";

const updateAppSettingsSchema = z.object({
	allowGoogleAccountCreation: z.boolean(),
});

const createUserSchema = z.object({
	email: z.email(),
	name: z.string().trim().max(80).nullable().optional(),
	password: z.string().min(8),
	passwordResetRequired: z.boolean().optional(),
});

const updateUserSchema = z.object({
	id: z.string(),
	email: z.email().optional(),
	name: z.string().trim().max(80).nullable().optional(),
	passwordLoginDisabled: z.boolean().optional(),
	passwordResetRequired: z.boolean().optional(),
});

const deleteUserSchema = z.object({
	id: z.string(),
});

const createPasswordResetSchema = z.object({
	email: z.email(),
});

const deletePasswordResetsSchema = z.object({
	userId: z.string().trim().min(1),
});

export const adminRouter = router({
	getAppSettings: superAdminProcedure.query(async () => {
		const settings = await getAppSettings();
		return { settings };
	}),

	updateAppSettings: superAdminProcedure.input(updateAppSettingsSchema).mutation(async ({ input }) => {
		const settings = await setAllowGoogleAccountCreation(input.allowGoogleAccountCreation);
		return { settings };
	}),

	createUser: superAdminProcedure.input(createUserSchema).mutation(async ({ input }) => {
		const normalizedEmail = input.email.trim().toLowerCase();
		const name = input.name?.trim() ?? "";
		const passwordResetRequired = input.passwordResetRequired ?? true;

		try {
			const passwordHash = await hashPassword(input.password);
			const user = await prisma.user.create({
				data: {
					email: normalizedEmail,
					name: name.length > 0 ? name : null,
					passwordHash,
					passwordResetRequired,
					passwordLoginDisabled: false,
				},
				select: {
					id: true,
					name: true,
					email: true,
					createdAt: true,
					isSuperAdmin: true,
					passwordResetRequired: true,
					passwordLoginDisabled: true,
				},
			});

			return {
				user: {
					...user,
					createdAt: user.createdAt.toISOString(),
					hasGoogleAccount: false,
				},
			};
		} catch (error) {
			if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
				throw new TRPCError({ code: "CONFLICT", message: "Email already in use" });
			}

			console.error("[admin:createUser]", error);
			throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Unable to create user" });
		}
	}),

	updateUser: superAdminProcedure.input(updateUserSchema).mutation(async ({ input }) => {
		const { id, ...updates } = input;

		if (
			updates.email === undefined &&
			updates.name === undefined &&
			updates.passwordLoginDisabled === undefined &&
			updates.passwordResetRequired === undefined
		) {
			throw new TRPCError({ code: "BAD_REQUEST", message: "No updates provided" });
		}

		const data: {
			email?: string;
			name?: string | null;
			passwordLoginDisabled?: boolean;
			passwordResetRequired?: boolean;
		} = {};
		if (updates.email !== undefined) {
			data.email = updates.email.trim().toLowerCase();
		}
		if (updates.name !== undefined) {
			const trimmedName = updates.name?.trim() ?? "";
			data.name = trimmedName.length > 0 ? trimmedName : null;
		}
		if (updates.passwordLoginDisabled !== undefined) {
			data.passwordLoginDisabled = updates.passwordLoginDisabled;
		}
		if (updates.passwordResetRequired !== undefined) {
			data.passwordResetRequired = updates.passwordResetRequired;
		}

		if (data.passwordLoginDisabled === true) {
			if (!isGoogleAuthEnabled) {
				throw new TRPCError({ code: "BAD_REQUEST", message: "Google OAuth is disabled" });
			}

			const hasGoogleAccount = await prisma.account.findFirst({
				where: { userId: id, provider: "google" },
				select: { id: true },
			});

			if (!hasGoogleAccount) {
				throw new TRPCError({ code: "BAD_REQUEST", message: "Link Google before disabling password login" });
			}

			data.passwordResetRequired = false;
		}

		try {
			const user = await prisma.user.update({
				where: { id },
				data,
				select: { id: true, name: true, email: true },
			});

			return { user };
		} catch (error) {
			if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
				throw new TRPCError({ code: "CONFLICT", message: "Email already in use" });
			}

			console.error("[admin:updateUser]", error);
			throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Unable to update user" });
		}
	}),

	deleteUser: superAdminProcedure.input(deleteUserSchema).mutation(async ({ ctx, input }) => {
		const { id } = input;

		if (ctx.session.user.id === id) {
			throw new TRPCError({ code: "BAD_REQUEST", message: "You cannot delete your own account" });
		}

		try {
			await prisma.user.delete({ where: { id } });
			return { ok: true };
		} catch (error) {
			console.error("[admin:deleteUser]", error);
			throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Failed to delete user" });
		}
	}),

	createPasswordReset: superAdminProcedure.input(createPasswordResetSchema).mutation(async ({ input }) => {
		const email = input.email.trim().toLowerCase();
		const user = await prisma.user.findUnique({
			where: { email },
			select: { id: true, email: true, passwordLoginDisabled: true },
		});

		if (!user) {
			throw new TRPCError({ code: "NOT_FOUND", message: "User not found" });
		}

		if (user.passwordLoginDisabled) {
			throw new TRPCError({ code: "BAD_REQUEST", message: "Password login is disabled for this user" });
		}

		const { token, expiresAt } = await createPasswordResetToken(user.id);

		const resetUrl = new URL(`/reset-password/${token}`, config.appUrl).toString();

		return {
			resetUrl,
			expiresAt: expiresAt.toISOString(),
		};
	}),

	deletePasswordResets: superAdminProcedure.input(deletePasswordResetsSchema).mutation(async ({ input }) => {
		const user = await prisma.user.findUnique({
			where: { id: input.userId },
			select: { id: true },
		});

		if (!user) {
			throw new TRPCError({ code: "NOT_FOUND", message: "User not found" });
		}

		const result = await prisma.passwordResetToken.deleteMany({
			where: { userId: user.id },
		});

		return { deleted: result.count };
	}),
});
