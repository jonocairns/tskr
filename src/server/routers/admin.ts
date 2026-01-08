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

const emailSchema = z.string().trim().pipe(z.email());

const createUserSchema = z.object({
	email: emailSchema,
	name: z.string().trim().max(80).nullable().optional(),
	password: z.string().min(8),
	passwordResetRequired: z.boolean().optional(),
});

const updateUserSchema = z.object({
	id: z.string(),
	email: emailSchema.optional(),
	name: z.string().trim().max(80).nullable().optional(),
	credentialDisabled: z.boolean().optional(),
	credentialPasswordResetRequired: z.boolean().optional(),
});

const deleteUserSchema = z.object({
	id: z.string(),
});

const createPasswordResetSchema = z.object({
	email: emailSchema,
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
					accounts: {
						create: {
							providerId: "credential",
							accountId: normalizedEmail,
							password: passwordHash,
							passwordResetRequired,
							disabled: false,
						},
					},
				},
				include: {
					accounts: {
						where: { providerId: "credential" },
						select: { passwordResetRequired: true, disabled: true },
					},
				},
			});

			const credentialAccount = user.accounts[0];

			return {
				user: {
					id: user.id,
					name: user.name,
					email: user.email,
					createdAt: user.createdAt.toISOString(),
					isSuperAdmin: user.isSuperAdmin,
					passwordResetRequired: credentialAccount?.passwordResetRequired ?? false,
					credentialDisabled: credentialAccount?.disabled ?? false,
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
			updates.credentialDisabled === undefined &&
			updates.credentialPasswordResetRequired === undefined
		) {
			throw new TRPCError({ code: "BAD_REQUEST", message: "No updates provided" });
		}

		let existingCredentialDisabled: boolean | null = null;
		if (updates.credentialPasswordResetRequired !== undefined && updates.credentialDisabled === undefined) {
			const credentialAccount = await prisma.account.findFirst({
				where: { userId: id, providerId: "credential" },
				select: { disabled: true },
			});

			if (!credentialAccount) {
				throw new TRPCError({ code: "BAD_REQUEST", message: "User has no credential account" });
			}

			existingCredentialDisabled = credentialAccount.disabled;
		}

		// Validate disabling credential login
		if (updates.credentialDisabled === true) {
			if (!isGoogleAuthEnabled) {
				throw new TRPCError({ code: "BAD_REQUEST", message: "Google OAuth is disabled" });
			}

			const hasGoogleAccount = await prisma.account.findFirst({
				where: { userId: id, providerId: "google" },
				select: { id: true },
			});

			if (!hasGoogleAccount) {
				throw new TRPCError({ code: "BAD_REQUEST", message: "Link Google before disabling password login" });
			}
		}

		try {
			// Update user fields (email, name)
			const userData: { email?: string; name?: string | null } = {};
			const normalizedEmail = updates.email?.trim().toLowerCase();
			if (updates.email !== undefined) {
				userData.email = normalizedEmail;
			}
			if (updates.name !== undefined) {
				const trimmedName = updates.name?.trim() ?? "";
				userData.name = trimmedName.length > 0 ? trimmedName : null;
			}

			// Update credential account fields
			const accountData: { disabled?: boolean; passwordResetRequired?: boolean; accountId?: string } = {};
			if (normalizedEmail) {
				accountData.accountId = normalizedEmail;
			}
			if (updates.credentialDisabled !== undefined) {
				accountData.disabled = updates.credentialDisabled;
				if (updates.credentialDisabled) {
					accountData.passwordResetRequired = false;
				}
			}
			if (updates.credentialPasswordResetRequired !== undefined && updates.credentialDisabled !== true) {
				accountData.passwordResetRequired = existingCredentialDisabled
					? false
					: updates.credentialPasswordResetRequired;
			}

			const [user] = await prisma.$transaction([
				prisma.user.update({
					where: { id },
					data: userData,
					select: { id: true, name: true, email: true },
				}),
				...(Object.keys(accountData).length > 0
					? [
							prisma.account.updateMany({
								where: { userId: id, providerId: "credential" },
								data: accountData,
							}),
						]
					: []),
			]);

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
			select: {
				id: true,
				email: true,
				accounts: {
					where: { providerId: "credential" },
					select: { disabled: true },
				},
			},
		});

		if (!user) {
			throw new TRPCError({ code: "NOT_FOUND", message: "User not found" });
		}

		const credentialAccount = user.accounts[0];
		if (!credentialAccount) {
			throw new TRPCError({ code: "BAD_REQUEST", message: "User has no credential account" });
		}

		if (credentialAccount.disabled) {
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
