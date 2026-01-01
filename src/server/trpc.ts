import "server-only";

import type { HouseholdRole } from "@prisma/client";
import { initTRPC, TRPCError } from "@trpc/server";
import superjson from "superjson";
import { z } from "zod";
import { getAuthSession } from "@/lib/auth";
import { checkForSensitiveInfo, sanitizeErrorMessage } from "@/lib/errorSanitization";
import { getActiveHouseholdMembership, getHouseholdMembership } from "@/lib/households";
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
		// In development, check for potential information leakage
		if (process.env.NODE_ENV !== "production" && error.message) {
			const warnings = checkForSensitiveInfo(error.message);
			if (warnings.length > 0) {
				console.warn(`[Security Warning] Error message may leak sensitive info: ${warnings.join(", ")}`);
				console.warn(`Original message: ${error.message}`);
			}
		}

		// Sanitize error messages for production
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

const hasHousehold = t.middleware(async ({ ctx, next }) => {
	if (!ctx.session?.user?.id) {
		throw new TRPCError({ code: "UNAUTHORIZED" });
	}

	const active = await getActiveHouseholdMembership(ctx.session.user.id);

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

		const active = await getActiveHouseholdMembership(ctx.session.user.id);

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

const hasApproverRole = t.middleware(async ({ ctx, next }) => {
	if (!ctx.session?.user?.id) {
		throw new TRPCError({ code: "UNAUTHORIZED" });
	}

	const active = await getActiveHouseholdMembership(ctx.session.user.id);

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

// These procedures just ensure the user is authenticated
// The householdId comes from the input schema and is validated there
// Role checking happens in the procedure implementation based on input.householdId
export const householdFromInputProcedure = protectedProcedure;
export const approverFromInputProcedure = protectedProcedure;
export const dictatorFromInputProcedure = protectedProcedure;

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
