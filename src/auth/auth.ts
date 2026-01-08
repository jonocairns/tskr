import { randomBytes, scrypt, timingSafeEqual } from "node:crypto";
import { promisify } from "node:util";
import { betterAuth } from "better-auth";
import { prismaAdapter } from "better-auth/adapters/prisma";
import { tanstackStartCookies } from "better-auth/tanstack-start";

import { getAppSettings } from "@/lib/appSettings";
import { prisma } from "@/lib/prisma";
import { config } from "@/server-config";

const scryptAsync = promisify(scrypt);
const HASH_KEY_LENGTH = 64;
const SALT_LENGTH = 16;

const googleProvider =
	config.googleClientId && config.googleClientSecret
		? {
				google: {
					clientId: config.googleClientId,
					clientSecret: config.googleClientSecret,
				},
			}
		: {};

export const auth = betterAuth({
	database: prismaAdapter(prisma, {
		provider: "sqlite",
	}),

	baseURL: config.appUrl,
	secret: process.env.BETTER_AUTH_SECRET ?? process.env.NEXTAUTH_SECRET,
	trustedOrigins: config.isDev
		? ["http://localhost:3000", "http://localhost:5173", "http://localhost:5174", "http://localhost:4173"]
		: [],

	emailAndPassword: {
		enabled: true,
		password: {
			async hash(password: string) {
				const salt = randomBytes(SALT_LENGTH).toString("hex");
				const derived = (await scryptAsync(password, salt, HASH_KEY_LENGTH)) as Buffer;
				return `scrypt$${salt}$${derived.toString("hex")}`;
			},
			async verify(data: { hash: string; password: string }) {
				const [scheme, salt, hash] = data.hash.split("$");
				if (scheme !== "scrypt" || !salt || !hash) {
					return false;
				}
				const storedBuffer = Buffer.from(hash, "hex");
				const derived = (await scryptAsync(data.password, salt, storedBuffer.length)) as Buffer;
				return timingSafeEqual(storedBuffer, derived);
			},
		},
	},

	socialProviders: googleProvider,

	session: {
		expiresIn: config.sessionMaxAge,
		updateAge: 60 * 60, // Update session every hour
		cookieCache: {
			enabled: true,
			maxAge: 5 * 60, // 5 minutes
		},
	},

	account: {
		accountLinking: {
			enabled: true,
			trustedProviders: ["google"],
			allowDifferentEmails: true,
		},
	},

	rateLimit: {
		enabled: true,
		window: 10 * 60, // 10 minutes
		max: 10, // 10 attempts per window
	},

	user: {
		additionalFields: {
			isSuperAdmin: {
				type: "boolean",
				defaultValue: false,
				input: false,
				returned: true,
			},
			lastHouseholdId: {
				type: "string",
				required: false,
				input: false,
				returned: true,
			},
		},
	},

	plugins: [
		tanstackStartCookies(), // Must be last for proper cookie handling in TanStack Start
	],

	databaseHooks: {
		user: {
			create: {
				before: async (user, ctx) => {
					console.log("[auth] user.create.before hook called with email:", user.email);
					const providerId =
						typeof ctx?.params === "object" && ctx?.params
							? "providerId" in ctx.params && typeof ctx.params.providerId === "string"
								? ctx.params.providerId
								: "id" in ctx.params && typeof ctx.params.id === "string"
									? ctx.params.id
									: null
							: null;
					const isCallbackPath =
						typeof ctx?.path === "string" &&
						(ctx.path === "/oauth2/callback/:providerId" || ctx.path === "/callback/:id");
					const shouldCheckGoogleSignup = providerId === "google" || (isCallbackPath && !providerId);
					if (!shouldCheckGoogleSignup) {
						return { data: user };
					}
					// For Google sign-ups, check if new account creation is allowed
					// Note: This only blocks NEW user creation, not account linking
					const settings = await getAppSettings();
					if (!settings.allowGoogleAccountCreation) {
						// Check if user already exists by email (this would be a linking/sign-in scenario)
						const existingUser = await prisma.user.findUnique({
							where: { email: user.email },
							select: { id: true },
						});
						console.log("[auth] Existing user found:", existingUser?.id ?? "none");
						if (existingUser) {
							// User exists - allow Better Auth to handle account linking
							return { data: user };
						}
						// No existing user - block creation of new users via Google
						console.log("[auth] Blocking new user creation via Google - allowGoogleAccountCreation is false");
						return false;
					}
					return { data: user };
				},
			},
		},
		account: {
			create: {
				after: async (account) => {
					// When a Google account is linked, optionally update user profile
					if (account.providerId === "google") {
						// Check if user already has other accounts (linking scenario vs first sign-up)
						const existingAccounts = await prisma.account.count({
							where: { userId: account.userId },
						});

						// If user has multiple accounts, don't overwrite their existing email/name
						// This prevents credential account email from being replaced by Google email
						if (existingAccounts > 1) {
							console.log("[auth] User already has accounts, skipping profile update from Google");
							return;
						}

						// First-time Google sign-up: update profile from Google
						const googleProfile = await prisma.account.findUnique({
							where: { id: account.id },
							select: { accessToken: true },
						});

						if (googleProfile?.accessToken) {
							try {
								const response = await fetch("https://www.googleapis.com/oauth2/v2/userinfo", {
									headers: { Authorization: `Bearer ${googleProfile.accessToken}` },
								});
								if (response.ok) {
									const googleUser = (await response.json()) as {
										email?: string;
										name?: string;
										picture?: string;
									};
									if (googleUser.email) {
										await prisma.user.update({
											where: { id: account.userId },
											data: {
												email: googleUser.email,
												name: googleUser.name || undefined,
												image: googleUser.picture || undefined,
											},
										});
									}
								}
							} catch (error) {
								console.error("[auth] Failed to fetch Google user info:", error);
							}
						}
					}
				},
			},
		},
	},
});

export type Session = typeof auth.$Infer.Session;
export type User = typeof auth.$Infer.Session.user;
