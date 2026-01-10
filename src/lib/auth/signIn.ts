import type { NextAuthOptions } from "next-auth";

import { getAppSettings } from "@/lib/appSettings";
import { createPasswordResetToken } from "@/lib/passwordReset";
import { checkRateLimit } from "@/lib/rateLimit";
import { config } from "@/server-config";
import { prisma } from "../prisma";

export const signIn: NonNullable<NextAuthOptions["callbacks"]>["signIn"] = async ({ user, account }) => {
	if (account?.provider === "google") {
		const providerAccountId = account.providerAccountId;
		if (!providerAccountId) {
			return false;
		}

		const existingAccount = await prisma.account.findUnique({
			where: {
				provider_providerAccountId: {
					provider: "google",
					providerAccountId,
				},
			},
			select: { id: true },
		});

		// For new accounts, check if creation is allowed and apply rate limiting
		if (!existingAccount) {
			const settings = await getAppSettings();
			if (!settings.allowGoogleAccountCreation) {
				return false;
			}

			// Rate limit new Google account creation: 10 per hour globally
			const rateCheck = checkRateLimit({ key: "google-signup:global", windowMs: 60 * 60_000, max: 10 });
			if (!rateCheck.ok) {
				return false;
			}
		}
	}

	if (!user?.id) {
		return true;
	}

	const dbUser = await prisma.user.findUnique({
		where: { id: user.id },
		select: { passwordResetRequired: true, passwordLoginDisabled: true },
	});

	if (dbUser?.passwordResetRequired && !dbUser.passwordLoginDisabled) {
		const { token } = await createPasswordResetToken(user.id);
		return new URL(`/reset-password/${token}`, config.appUrl).toString();
	}

	return true;
};
