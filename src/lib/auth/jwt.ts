import type { NextAuthOptions } from "next-auth";

export const jwt: NonNullable<NextAuthOptions["callbacks"]>["jwt"] = async ({ token, user, trigger }) => {
	if (user?.id) {
		token.sub = user.id;
	}

	// Track token creation time and last activity
	const now = Math.floor(Date.now() / 1000);

	// Set iat (issued at) on first creation
	if (!token.iat) {
		token.iat = now;
	}

	// Update lastActivity on every request (for idle timeout)
	// But only if this isn't the initial token creation
	if (trigger === "update" || token.lastActivity !== undefined) {
		token.lastActivity = now;
	} else if (!token.lastActivity) {
		// First time seeing this token, set lastActivity to iat
		token.lastActivity = token.iat;
	}

	return token;
};
