import { PrismaAdapter } from "@next-auth/prisma-adapter";
import type { PrismaClient } from "@prisma/client";
import { type NextAuthOptions, getServerSession } from "next-auth";
import CredentialsProvider from "next-auth/providers/credentials";
import GoogleProvider from "next-auth/providers/google";

import { ensureDefaultSuperAdmin } from "@/lib/admin";
import { getAppSettings } from "@/lib/app-settings";
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

const normalizeEmail = (email: string) => email.trim().toLowerCase();

const getProfileEmail = (profile: unknown) => {
	if (!profile || typeof profile !== "object") {
		return null;
	}

	const maybeEmail = (profile as { email?: unknown }).email;
	return typeof maybeEmail === "string" ? maybeEmail : null;
};

const getProfileName = (profile: unknown) => {
	if (!profile || typeof profile !== "object") {
		return null;
	}

	const maybeName = (profile as { name?: unknown }).name;
	return typeof maybeName === "string" ? maybeName : null;
};

const getProfileImage = (profile: unknown) => {
	if (!profile || typeof profile !== "object") {
		return null;
	}

	const maybeImage = (profile as { picture?: unknown }).picture;
	return typeof maybeImage === "string" ? maybeImage : null;
};

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
					typeof credentials?.password === "string" ? credentials.password : "";

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
	pages: {
		error: "/auth/error",
	},
	events: {
		linkAccount: async ({ user, account, profile }) => {
			if (account?.provider !== "google") {
				return;
			}

			const profileEmail = getProfileEmail(profile);
			const profileName = getProfileName(profile);
			const profileImage = getProfileImage(profile);
			if (!profileEmail && !profileName && !profileImage) {
				return;
			}

			const updates: { email?: string; name?: string | null; image?: string } =
				{};

			if (profileEmail) {
				const normalizedEmail = normalizeEmail(profileEmail);
				if (normalizedEmail && user.email?.toLowerCase() !== normalizedEmail) {
					const existing = await prisma.user.findUnique({
						where: { email: normalizedEmail },
						select: { id: true },
					});

					if (existing && existing.id !== user.id) {
						console.warn(
							"Skipping Google email sync because the email is already in use.",
						);
					} else {
						updates.email = normalizedEmail;
					}
				}
			}

			if (profileName && profileName !== user.name) {
				updates.name = profileName;
			}

			if (profileImage && profileImage !== user.image) {
				updates.image = profileImage;
			}

			if (Object.keys(updates).length === 0) {
				return;
			}

			await prisma.user.update({
				where: { id: user.id },
				data: updates,
			});
		},
	},
	callbacks: {
		signIn: async ({ user, account }) => {
			if (account?.provider === "google") {
				const settings = await getAppSettings();
				if (!settings.allowGoogleAccountCreation) {
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

					if (!existingAccount) {
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
						name: true,
						email: true,
						image: true,
						lastHouseholdId: true,
						isSuperAdmin: true,
						memberships: {
							select: { id: true },
							take: 1,
						},
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

				let resolvedHouseholdId: string | null = null;
				let membershipRole: "DICTATOR" | "APPROVER" | "DOER" | null = null;

				if (dbUser.lastHouseholdId) {
					const membership = await prisma.householdMember.findFirst({
						where: {
							userId: token.sub,
							householdId: dbUser.lastHouseholdId,
						},
						select: { role: true },
					});

					if (membership) {
						resolvedHouseholdId = dbUser.lastHouseholdId;
						membershipRole = membership.role;
					}
				}

				if (!resolvedHouseholdId) {
					const fallback = await prisma.householdMember.findFirst({
						where: { userId: token.sub },
						select: { householdId: true, role: true },
						orderBy: { joinedAt: "asc" },
					});

					if (fallback) {
						resolvedHouseholdId = fallback.householdId;
						membershipRole = fallback.role;
					}
				}

				session.user.id = token.sub;
				session.user.name = dbUser.name;
				session.user.email = dbUser.email;
				session.user.image = dbUser.image;
				session.user.householdId = resolvedHouseholdId;
				session.user.householdRole = membershipRole;
				session.user.isSuperAdmin = dbUser.isSuperAdmin ?? false;
				session.user.hasGoogleAccount = dbUser.accounts.length > 0;
				session.user.hasHouseholdMembership = dbUser.memberships.length > 0;
			}
			return session;
		},
	},
};

export const getAuthSession = () => getServerSession(authOptions);

void ensureDefaultSuperAdmin().catch((error) => {
	console.error("Failed to ensure default super admin", error);
});
