import "server-only";

import { initTRPC, TRPCError } from "@trpc/server";
import superjson from "superjson";
import { z } from "zod";
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

type AuthedUser = NonNullable<NonNullable<Context["session"]>["user"]>;
type AuthedSession = NonNullable<Context["session"]> & { user: AuthedUser };
type AuthedContext = Context & { session: AuthedSession };

const getAuthedSession = (ctx: Context): AuthedSession => {
	const session = ctx.session;
	const user = session?.user;
	if (!session || !user?.id) {
		throw new TRPCError({ code: "UNAUTHORIZED" });
	}
	return { ...session, user };
};

const isAuthed = t.middleware(({ ctx, next }) => {
	const session = getAuthedSession(ctx);

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
			session,
		} satisfies AuthedContext,
	});
});

export const protectedProcedure = t.procedure.use(isAuthed);

const householdIdSchema = z.object({ householdId: z.string().min(1) });

type HouseholdContext = { household: { id: string; membership: HouseholdMembership } };

const validateMembership = t.middleware(async ({ ctx, input, next }) => {
	const parsed = householdIdSchema.safeParse(input);
	if (!parsed.success) {
		throw new TRPCError({ code: "BAD_REQUEST", message: "householdId is required" });
	}

	const session = getAuthedSession(ctx);
	const membership = await getHouseholdMembership(session.user.id, parsed.data.householdId);
	if (!membership) {
		throw new TRPCError({ code: "FORBIDDEN", message: "You are not a member of this household" });
	}

	return next({
		ctx: {
			...ctx,
			session,
			household: { id: parsed.data.householdId, membership },
		},
	});
});

const validateApprover = t.middleware(async ({ ctx, next }) => {
	const { membership } = (ctx as typeof ctx & HouseholdContext).household;
	if (membership.role !== "APPROVER" && membership.role !== "DICTATOR") {
		throw new TRPCError({ code: "FORBIDDEN", message: "Requires APPROVER or DICTATOR role" });
	}
	return next();
});

const validateDictator = t.middleware(async ({ ctx, next }) => {
	const { membership } = (ctx as typeof ctx & HouseholdContext).household;
	if (membership.role !== "DICTATOR") {
		throw new TRPCError({ code: "FORBIDDEN", message: "Requires DICTATOR role" });
	}
	return next();
});

export const householdProcedure = <TInput extends z.ZodTypeAny>(inputSchema: TInput) =>
	protectedProcedure.input(inputSchema).use(validateMembership);

export const approverProcedure = <TInput extends z.ZodTypeAny>(inputSchema: TInput) =>
	householdProcedure(inputSchema).use(validateApprover);

export const dictatorProcedure = <TInput extends z.ZodTypeAny>(inputSchema: TInput) =>
	householdProcedure(inputSchema).use(validateDictator);

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
