import { PrismaAdapter } from "@next-auth/prisma-adapter";
import type { PrismaClient } from "@prisma/client";
import { getServerSession, type NextAuthOptions } from "next-auth";
import CredentialsProvider from "next-auth/providers/credentials";
import GoogleProvider from "next-auth/providers/google";

import { isGoogleAuthEnabled } from "@/lib/authConfig";
import { config } from "@/server-config";
import { authorize } from "./auth/authorize";
import { jwt } from "./auth/jwt";
import { linkAccount } from "./auth/linkAccount";
import { session } from "./auth/session";
import { signIn } from "./auth/signIn";
import { prisma } from "./prisma";

const { googleClientId, googleClientSecret } = config;

if (!isGoogleAuthEnabled && config.isDev) {
	console.warn("Google OAuth is disabled. Set GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET to enable it.");
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
			authorize,
		}),
		...(isGoogleAuthEnabled
			? [GoogleProvider({ clientId: googleClientId ?? "", clientSecret: googleClientSecret ?? "" })]
			: []),
	],
	session: {
		strategy: "jwt",
		maxAge: config.sessionMaxAge, // 30 days
	},
	jwt: {
		maxAge: config.sessionMaxAge, // 30 days
	},
	pages: {
		signIn: "/",
		error: "/auth/error",
	},
	events: {
		linkAccount,
	},
	callbacks: {
		signIn,
		jwt,
		session,
	},
};

export const getAuthSession = () => getServerSession(authOptions);
