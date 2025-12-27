import { PrismaAdapter } from "@next-auth/prisma-adapter";
import type { PrismaClient } from "@prisma/client";
import { type NextAuthOptions, getServerSession } from "next-auth";
import CredentialsProvider from "next-auth/providers/credentials";
import GoogleProvider from "next-auth/providers/google";

import { ensureDefaultSuperAdmin } from "@/lib/admin";
import { createPasswordResetToken } from "@/lib/password-reset";
import { verifyPassword } from "@/lib/passwords";
import { config } from "@/server-config";
import { prisma } from "./prisma";

const { googleClientId, googleClientSecret } = config;

if (!googleClientId || !googleClientSecret) {
	console.warn(
		"GOOGLE_CLIENT_ID or GOOGLE_CLIENT_SECRET is missing. Sign-in will fail until these are set.",
	);
}

export const authOptions: NextAuthOptions = {
	adapter: PrismaAdapter(prisma as PrismaClient),
	providers: [
		CredentialsProvider({
			name: "Email",
			credentials: {
				email: { label: "Email", type: "email" },
				password: { label: "Password", type: "password" },
			},
			authorize: async (credentials) => {
				const email =
					typeof credentials?.email === "string"
						? credentials.email.trim().toLowerCase()
						: "";
				const password =
					typeof credentials?.password === "string"
						? credentials.password
						: "";

				if (!email || !password) {
					return null;
				}

				await ensureDefaultSuperAdmin();

				const user = await prisma.user.findUnique({
					where: { email },
					select: {
						id: true,
						email: true,
						name: true,
						image: true,
						passwordHash: true,
						passwordLoginDisabled: true,
					},
				});

				if (!user?.passwordHash || user.passwordLoginDisabled) {
					return null;
				}

				const isValid = await verifyPassword(password, user.passwordHash);
				if (!isValid) {
					return null;
				}

				return {
					id: user.id,
					email: user.email,
					name: user.name,
					image: user.image,
				};
			},
		}),
		GoogleProvider({
			clientId: googleClientId ?? "",
			clientSecret: googleClientSecret ?? "",
		}),
	],
	session: {
		strategy: "jwt",
	},
	callbacks: {
		signIn: async ({ user }) => {
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
		},
		jwt: async ({ token, user }) => {
			if (user?.id) {
				token.sub = user.id;
			}
			return token;
		},
		session: async ({ session, token }) => {
			if (session.user && token.sub) {
				const dbUser = await prisma.user.findUnique({
					where: { id: token.sub },
					select: {
						lastHouseholdId: true,
						isSuperAdmin: true,
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
				session.user.householdId = dbUser.lastHouseholdId ?? null;
				session.user.isSuperAdmin = dbUser.isSuperAdmin ?? false;
				session.user.hasGoogleAccount = dbUser.accounts.length > 0;
			}
			return session;
		},
	},
};

export const getAuthSession = () => getServerSession(authOptions);

void ensureDefaultSuperAdmin().catch((error) => {
	console.error("Failed to ensure default super admin", error);
});
