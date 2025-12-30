import "server-only";

import type { HouseholdRole } from "@prisma/client";
import { initTRPC, TRPCError } from "@trpc/server";
import superjson from "superjson";
import { getAuthSession } from "@/lib/auth";
import { getActiveHouseholdMembership } from "@/lib/households";

export async function createTRPCContext() {
	const session = await getAuthSession();

	return {
		session,
	};
}

export type Context = Awaited<ReturnType<typeof createTRPCContext>>;

const t = initTRPC.context<Context>().create({
	transformer: superjson,
	errorFormatter({ shape }) {
		return shape;
	},
});

export const router = t.router;
export const publicProcedure = t.procedure;

const isAuthed = t.middleware(({ ctx, next }) => {
	if (!ctx.session?.user?.id) {
		throw new TRPCError({ code: "UNAUTHORIZED" });
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

export const approverProcedure = t.procedure.use(isAuthed).use(
	t.middleware(async ({ ctx, next }) => {
		if (!ctx.session?.user?.id) {
			throw new TRPCError({ code: "UNAUTHORIZED" });
		}

		const active = await getActiveHouseholdMembership(ctx.session.user.id, ctx.session.user.householdId ?? null);

		if (!active) {
			throw new TRPCError({ code: "FORBIDDEN", message: "Household not found" });
		}

		if (active.membership.role !== "APPROVER" && active.membership.role !== "DICTATOR") {
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
	}),
);

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
