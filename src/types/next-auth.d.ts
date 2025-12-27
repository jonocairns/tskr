import type { DefaultSession } from "next-auth";

declare module "next-auth" {
	interface Session {
		user?: {
			id: string;
			householdId?: string | null;
			isSuperAdmin?: boolean;
			hasGoogleAccount?: boolean;
		} & DefaultSession["user"];
	}

	interface User {
		id: string;
		lastHouseholdId?: string | null;
		isSuperAdmin?: boolean;
	}
}
