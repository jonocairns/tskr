import type { DefaultSession } from "next-auth";
import type { DefaultJWT } from "next-auth/jwt";

declare module "next-auth" {
	interface Session {
		user?: {
			id: string;
			isSuperAdmin?: boolean;
			hasGoogleAccount?: boolean;
		} & DefaultSession["user"];
		/**
		 * Issued at timestamp (Unix timestamp in seconds).
		 * Used for absolute session expiry validation.
		 */
		iat?: number;
		/**
		 * Last activity timestamp (Unix timestamp in seconds).
		 * Updated on every request and used for idle timeout validation.
		 */
		lastActivity?: number;
	}

	interface User {
		id: string;
		lastHouseholdId?: string | null;
		isSuperAdmin?: boolean;
	}
}

declare module "next-auth/jwt" {
	interface JWT extends DefaultJWT {
		/**
		 * Issued at timestamp (Unix timestamp in seconds).
		 * Used for absolute session expiry validation.
		 */
		iat?: number;
		/**
		 * Last activity timestamp (Unix timestamp in seconds).
		 * Updated on every request and used for idle timeout validation.
		 */
		lastActivity?: number;
	}
}
