import type { CredentialsConfig } from "next-auth/providers/credentials";

import { isLoginRateLimited } from "@/lib/loginRateLimit";
import { verifyPassword } from "@/lib/passwords";
import { prisma } from "../prisma";

export const authorize: CredentialsConfig["authorize"] = async (credentials, req) => {
	const email = typeof credentials?.email === "string" ? credentials.email.trim().toLowerCase() : "";
	const password = typeof credentials?.password === "string" ? credentials.password : "";

	if (!email || !password) {
		return null;
	}

	if (isLoginRateLimited(email, req)) {
		return null;
	}

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
};
