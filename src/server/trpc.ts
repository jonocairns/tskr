import "server-only";

import { initTRPC, TRPCError } from "@trpc/server";
import superjson from "superjson";
import { getAuthSession } from "@/lib/auth";
import { checkForSensitiveInfo, sanitizeErrorMessage } from "@/lib/errorSanitization";
import { getHouseholdMembership, type HouseholdMembership } from "@/lib/households";
import { validateSessionExpiry } from "@/lib/sessionValidation";

export async function createTRPCContext(opts?: { req?: Request }) {
	const session = await getAuthSession();

	return {
		session,
		sessionTimestamps: {
			iat: session?.iat,
			lastActivity: session?.lastActivity,
		},
		req: opts?.req,
	};
}

export type Context = Awaited<ReturnType<typeof createTRPCContext>>;

const t = initTRPC.context<Context>().create({
	transformer: superjson,
	errorFormatter({ shape, error }) {
		if (process.env.NODE_ENV !== "production" && error.message) {
			const warnings = checkForSensitiveInfo(error.message);
			if (warnings.length > 0) {
				console.warn(`[Security Warning] Error message may leak sensitive info: ${warnings.join(", ")}`);
				console.warn(`Original message: ${error.message}`);
			}
		}

		const sanitizedMessage = sanitizeErrorMessage(shape.message, shape.data?.code || "INTERNAL_SERVER_ERROR");

		return {
			...shape,
			message: sanitizedMessage,
		};
	},
});

export const router = t.router;
export const publicProcedure = t.procedure;

const isAuthed = t.middleware(({ ctx, next }) => {
	if (!ctx.session?.user?.id) {
		throw new TRPCError({ code: "UNAUTHORIZED" });
	}

	const validation = validateSessionExpiry(ctx.sessionTimestamps);
	if (!validation.valid) {
		const message = validation.reason === "idle_timeout" ? "Session expired due to inactivity" : "Session expired";
		throw new TRPCError({
			code: "UNAUTHORIZED",
			message,
		});
	}

	return next({
		ctx: {
			...ctx,
			session: {
				...ctx.session,
				user: ctx.session.user,
			},
		},
	});
});

export const protectedProcedure = t.procedure.use(isAuthed);

/**
 * Helper to validate household membership from input.
 * Use this at the start of procedure handlers to ensure early validation.
 */
export async function validateHouseholdMembershipFromInput(
	userId: string,
	input: { householdId: string },
): Promise<{ householdId: string; membership: HouseholdMembership }> {
	const { householdId } = input;

	if (!householdId) {
		throw new TRPCError({
			code: "BAD_REQUEST",
			message: "householdId is required",
		});
	}

	const membership = await getHouseholdMembership(userId, householdId);

	if (!membership) {
		throw new TRPCError({
			code: "FORBIDDEN",
			message: "You are not a member of this household",
		});
	}

	return { householdId, membership };
}

export async function validateApproverRoleFromInput(
	userId: string,
	input: { householdId: string },
): Promise<{ householdId: string; membership: HouseholdMembership }> {
	const { householdId, membership } = await validateHouseholdMembershipFromInput(userId, input);

	const role = membership.role;
	if (role !== "APPROVER" && role !== "DICTATOR") {
		throw new TRPCError({
			code: "FORBIDDEN",
			message: "Insufficient permissions - requires APPROVER or DICTATOR role",
		});
	}

	return { householdId, membership };
}

export async function validateDictatorRoleFromInput(
	userId: string,
	input: { householdId: string },
): Promise<{ householdId: string; membership: HouseholdMembership }> {
	const { householdId, membership } = await validateHouseholdMembershipFromInput(userId, input);

	if (membership.role !== "DICTATOR") {
		throw new TRPCError({
			code: "FORBIDDEN",
			message: "Insufficient permissions - requires DICTATOR role",
		});
	}

	return { householdId, membership };
}

const isSuperAdmin = t.middleware(({ ctx, next }) => {
	if (!ctx.session?.user?.id) {
		throw new TRPCError({ code: "UNAUTHORIZED" });
	}

	if (!ctx.session.user.isSuperAdmin) {
		throw new TRPCError({ code: "FORBIDDEN", message: "Super admin access required" });
	}

	return next({
		ctx: {
			...ctx,
			session: {
				...ctx.session,
				user: ctx.session.user,
			},
		},
	});
});

export const superAdminProcedure = t.procedure.use(isAuthed).use(isSuperAdmin);
