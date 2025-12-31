import "server-only";

import type { HouseholdRole } from "@prisma/client";
import { initTRPC, TRPCError } from "@trpc/server";
import superjson from "superjson";
import { getAuthSession } from "@/lib/auth";
import { checkForSensitiveInfo, sanitizeErrorMessage } from "@/lib/errorSanitization";
import { getActiveHouseholdMembership } from "@/lib/households";
import { validateSessionExpiry } from "@/lib/sessionValidation";

export async function createTRPCContext() {
	const session = await getAuthSession();

	return {
		session,
		// Session timestamps are now properly typed in next-auth.d.ts
		sessionTimestamps: {
			iat: session?.iat,
			lastActivity: session?.lastActivity,
		},
	};
}

export type Context = Awaited<ReturnType<typeof createTRPCContext>>;

/**
 * tRPC instance configured with SuperJSON transformer.
 *
 * SuperJSON automatically serializes/deserializes:
 * - Date objects (from Prisma timestamps like createdAt, updatedAt, expiresAt)
 * - undefined values (JSON doesn't support undefined)
 * - BigInt values (if used in the future)
 * - Map, Set (if used in the future)
 * - Regular expressions (if used)
 *
 * This means you can return Date objects from procedures and they'll
 * be properly serialized across the network and deserialized on the client.
 *
 * Example:
 * ```ts
 * // Server procedure
 * getCurrent: householdProcedure.query(async ({ ctx }) => {
 *   const household = await prisma.household.findUnique({ ... });
 *   return { household }; // createdAt is a Date object
 * });
 *
 * // Client usage
 * const { data } = trpc.households.getCurrent.useQuery();
 * // data.household.createdAt is still a Date object, not a string!
 * console.log(data.household.createdAt.getFullYear());
 * ```
 */
const t = initTRPC.context<Context>().create({
	transformer: superjson,
	errorFormatter({ shape, error }) {
		// In development, check for potential information leakage
		if (process.env.NODE_ENV !== "production" && error.message) {
			const warnings = checkForSensitiveInfo(error.message);
			if (warnings.length > 0) {
				console.warn(`[Security Warning] Error message may leak sensitive info: ${warnings.join(", ")}`);
				console.warn(`Original message: ${error.message}`);
			}
		}

		// Sanitize error messages for production
		const sanitizedMessage = sanitizeErrorMessage(
			shape.message,
			shape.data?.code || "INTERNAL_SERVER_ERROR",
		);

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

	// Validate session expiry and idle timeout
	const validation = validateSessionExpiry(ctx.sessionTimestamps);
	if (!validation.valid) {
		const message = validation.reason === "idle_timeout"
			? "Session expired due to inactivity"
			: "Session expired";
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

const hasHousehold = t.middleware(async ({ ctx, next }) => {
	if (!ctx.session?.user?.id) {
		throw new TRPCError({ code: "UNAUTHORIZED" });
	}

	const active = await getActiveHouseholdMembership(ctx.session.user.id, ctx.session.user.householdId ?? null);

	if (!active) {
		throw new TRPCError({ code: "FORBIDDEN", message: "Household not found" });
	}

	return next({
		ctx: {
			...ctx,
			session: {
				...ctx.session,
				user: ctx.session.user,
			},
			household: {
				id: active.householdId,
				role: active.membership.role,
			},
		},
	});
});

const hasRole = (requiredRole: HouseholdRole) =>
	t.middleware(async ({ ctx, next }) => {
		if (!ctx.session?.user?.id) {
			throw new TRPCError({ code: "UNAUTHORIZED" });
		}

		const active = await getActiveHouseholdMembership(ctx.session.user.id, ctx.session.user.householdId ?? null);

		if (!active) {
			throw new TRPCError({ code: "FORBIDDEN", message: "Household not found" });
		}

		if (active.membership.role !== requiredRole) {
			throw new TRPCError({ code: "FORBIDDEN", message: "Insufficient permissions" });
		}

		return next({
			ctx: {
				...ctx,
				session: {
					...ctx.session,
					user: ctx.session.user,
				},
				household: {
					id: active.householdId,
					role: active.membership.role,
				},
			},
		});
	});

export const protectedProcedure = t.procedure.use(isAuthed);

export const householdProcedure = t.procedure.use(isAuthed).use(hasHousehold);

export const dictatorProcedure = t.procedure.use(isAuthed).use(hasRole("DICTATOR"));

/**
 * Combined middleware that checks both household membership AND approver/dictator role.
 * This is more efficient than chaining hasHousehold + role check as it only
 * fetches the household membership once.
 */
const hasApproverRole = t.middleware(async ({ ctx, next }) => {
	if (!ctx.session?.user?.id) {
		throw new TRPCError({ code: "UNAUTHORIZED" });
	}

	const active = await getActiveHouseholdMembership(ctx.session.user.id, ctx.session.user.householdId ?? null);

	if (!active) {
		throw new TRPCError({ code: "FORBIDDEN", message: "Household not found" });
	}

	const role = active.membership.role;
	if (role !== "APPROVER" && role !== "DICTATOR") {
		throw new TRPCError({ code: "FORBIDDEN", message: "Insufficient permissions" });
	}

	return next({
		ctx: {
			...ctx,
			session: {
				...ctx.session,
				user: ctx.session.user,
			},
			household: {
				id: active.householdId,
				role: active.membership.role,
			},
		},
	});
});

export const approverProcedure = t.procedure.use(isAuthed).use(hasApproverRole);

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
