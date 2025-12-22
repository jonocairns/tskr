import { PrismaAdapter } from "@next-auth/prisma-adapter";
import { type NextAuthOptions, getServerSession } from "next-auth";
import GoogleProvider from "next-auth/providers/google";

import { prisma } from "./prisma";

const googleClientId = process.env.GOOGLE_CLIENT_ID;
const googleClientSecret = process.env.GOOGLE_CLIENT_SECRET;

if (!googleClientId || !googleClientSecret) {
	console.warn(
		"GOOGLE_CLIENT_ID or GOOGLE_CLIENT_SECRET is missing. Sign-in will fail until these are set.",
	);
}

export const authOptions: NextAuthOptions = {
	adapter: PrismaAdapter(prisma),
	providers: [
		GoogleProvider({
			clientId: googleClientId ?? "",
			clientSecret: googleClientSecret ?? "",
		}),
	],
	session: {
		strategy: "database",
	},
	callbacks: {
		session: async ({ session, user }) => {
			if (session.user) {
				session.user.id = user.id;
			}
			return session;
		},
	},
};

export const getAuthSession = () => getServerSession(authOptions);
