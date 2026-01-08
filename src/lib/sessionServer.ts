import { redirect } from "@tanstack/react-router";
import { getRequestHeaders } from "@tanstack/react-start/server";

import { auth, type Session } from "@/auth/auth";
import { isSessionValid } from "@/lib/sessionValidation";

export const getValidSession = async (headers?: Headers): Promise<Session | null> => {
	const session = await auth.api.getSession({ headers: headers ?? getRequestHeaders() });
	if (!session?.user?.id || !isSessionValid(session)) {
		return null;
	}
	return session;
};

export const requireValidSession = async (options?: { headers?: Headers; redirectTo?: string }) => {
	const session = await getValidSession(options?.headers);
	if (!session) {
		throw redirect({ to: options?.redirectTo ?? "/", search: { error: undefined } });
	}
	return session;
};
