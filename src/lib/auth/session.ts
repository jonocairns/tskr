import type { NextAuthOptions } from "next-auth";

import { isGoogleAuthEnabled } from "@/lib/authConfig";
import { DEFAULT_LANGUAGE } from "@/lib/i18nConfig";
import { prisma } from "../prisma";

export const session: NonNullable<NextAuthOptions["callbacks"]>["session"] = async ({ session, token }) => {
	if (session.user && token.sub) {
		const dbUser = await prisma.user.findUnique({
			where: { id: token.sub },
			select: {
				name: true,
				email: true,
				image: true,
				isSuperAdmin: true,
				language: true,
				accounts: {
					where: { provider: "google" },
					select: { id: true },
					take: 1,
				},
			},
		});

		if (!dbUser) {
			session.user = undefined;
			return session;
		}

		session.user.id = token.sub;
		session.user.name = dbUser.name;
		session.user.email = dbUser.email;
		session.user.image = dbUser.image;
		session.user.isSuperAdmin = dbUser.isSuperAdmin ?? false;
		session.user.language = dbUser.language ?? DEFAULT_LANGUAGE;
		session.user.hasGoogleAccount = isGoogleAuthEnabled && dbUser.accounts.length > 0;
	}

	// Pass JWT timestamps to session for validation in tRPC middleware
	// These are used for session expiry and idle timeout checks
	return {
		...session,
		iat: token.iat,
		lastActivity: token.lastActivity,
	};
};
