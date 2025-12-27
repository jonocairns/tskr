import type { DefaultSession } from "next-auth";

declare module "next-auth" {
	interface Session {
		user?: {
			id: string;
			householdId?: string | null;
			householdRole?: "DICTATOR" | "APPROVER" | "DOER" | null;
			isSuperAdmin?: boolean;
			hasGoogleAccount?: boolean;
			hasHouseholdMembership?: boolean;
		} & DefaultSession["user"];
	}

	interface User {
		id: string;
		lastHouseholdId?: string | null;
		isSuperAdmin?: boolean;
	}
}
