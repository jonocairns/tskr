import "server-only";

import { randomBytes } from "node:crypto";

import { TRPCError } from "@trpc/server";
import { z } from "zod";

import { resolveActiveHouseholdId } from "@/lib/households";
import { prisma } from "@/lib/prisma";
import { dictatorProcedure, householdProcedure, protectedProcedure, router } from "@/server/trpc";

const INVITE_EXPIRY_DAYS = 14;
const JOIN_RATE_LIMIT_WINDOW_MS = 60_000;
const JOIN_RATE_LIMIT_MAX = 5;

type RateLimitEntry = {
	count: number;
	resetAt: number;
};

declare global {
	var joinRateLimit: Map<string, RateLimitEntry> | undefined;
}

const rateLimitStore = globalThis.joinRateLimit ?? new Map<string, RateLimitEntry>();

if (!globalThis.joinRateLimit) {
	globalThis.joinRateLimit = rateLimitStore;
}

const checkRateLimit = (key: string) => {
	const now = Date.now();
	const entry = rateLimitStore.get(key);
	if (!entry || entry.resetAt <= now) {
		const resetAt = now + JOIN_RATE_LIMIT_WINDOW_MS;
		rateLimitStore.set(key, { count: 1, resetAt });
		return { ok: true, resetAt };
	}

	if (entry.count >= JOIN_RATE_LIMIT_MAX) {
		return { ok: false, resetAt: entry.resetAt };
	}

	entry.count += 1;
	return { ok: true, resetAt: entry.resetAt };
};

const addExpiry = () => {
	const expiresAt = new Date();
	expiresAt.setDate(expiresAt.getDate() + INVITE_EXPIRY_DAYS);
	return expiresAt;
};

const generateCode = () => randomBytes(8).toString("hex").toUpperCase();

const updateSchema = z.object({
	name: z.string().trim().min(2, "Name is too short").max(50, "Keep the name short"),
	rewardThreshold: z.number().int().min(1, "Threshold must be at least 1").max(10000, "Threshold is too high"),
	progressBarColor: z
		.string()
		.regex(/^#([0-9a-fA-F]{6})$/, "Color must be a 6-digit hex value")
		.nullable(),
});

const createHouseholdSchema = z.object({
	name: z.string().trim().min(2).max(50).optional(),
});

const inviteSchema = z.object({
	role: z.enum(["DICTATOR", "APPROVER", "DOER"]).optional(),
});

const inviteActionSchema = z.object({
	id: z.string(),
	action: z.enum(["revoke", "resend"]),
});

const joinSchema = z.object({
	code: z.string().trim().min(4),
});

const selectHouseholdSchema = z.object({
	householdId: z.string().min(1),
});

const updateMemberSchema = z
	.object({
		id: z.string(),
		role: z.enum(["DICTATOR", "APPROVER", "DOER"]).optional(),
		requiresApprovalDefault: z.boolean().optional(),
	})
	.refine((data) => data.role !== undefined || data.requiresApprovalDefault !== undefined, {
		message: "No updates provided",
	});

export const householdsRouter = router({
	getCurrent: householdProcedure.query(async ({ ctx }) => {
		const household = await prisma.household.findUnique({
			where: { id: ctx.household.id },
			select: {
				id: true,
				name: true,
				createdById: true,
				rewardThreshold: true,
				progressBarColor: true,
			},
		});

		if (!household) {
			throw new TRPCError({ code: "NOT_FOUND", message: "Household not found" });
		}

		return { household };
	}),

	updateCurrent: dictatorProcedure.input(updateSchema.partial()).mutation(async ({ ctx, input }) => {
		if (!input.name && input.rewardThreshold === undefined && input.progressBarColor === undefined) {
			throw new TRPCError({ code: "BAD_REQUEST", message: "No updates provided" });
		}

		const household = await prisma.household.update({
			where: { id: ctx.household.id },
			data: {
				...(input.name ? { name: input.name.trim() } : {}),
				...(input.rewardThreshold !== undefined ? { rewardThreshold: input.rewardThreshold } : {}),
				...(input.progressBarColor !== undefined ? { progressBarColor: input.progressBarColor } : {}),
			},
			select: {
				id: true,
				name: true,
				rewardThreshold: true,
				progressBarColor: true,
			},
		});

		return { household };
	}),

	deleteCurrent: dictatorProcedure.mutation(async ({ ctx }) => {
		await prisma.$transaction(async (tx) => {
			await tx.user.updateMany({
				where: { lastHouseholdId: ctx.household.id },
				data: { lastHouseholdId: null },
			});

			await tx.household.delete({
				where: { id: ctx.household.id },
			});
		});

		return { ok: true };
	}),

	// List all households for the current user
	list: protectedProcedure.query(async ({ ctx }) => {
		const userId = ctx.session.user.id;
		const activeHouseholdId = await resolveActiveHouseholdId(userId, ctx.session.user.householdId ?? null);

		const memberships = await prisma.householdMember.findMany({
			where: { userId },
			select: {
				householdId: true,
				role: true,
				joinedAt: true,
				household: { select: { name: true } },
			},
			orderBy: { joinedAt: "asc" },
		});

		const households = memberships.map((membership) => ({
			id: membership.householdId,
			name: membership.household.name,
			role: membership.role,
		}));

		return {
			households,
			activeHouseholdId: activeHouseholdId ?? null,
		};
	}),

	// Create a new household
	create: protectedProcedure.input(createHouseholdSchema).mutation(async ({ ctx, input }) => {
		const userId = ctx.session.user.id;
		const defaultName = "My household";
		const name = input.name && input.name.trim().length >= 2 ? input.name.trim() : defaultName;

		const household = await prisma.household.create({
			data: {
				name,
				createdById: userId,
				members: {
					create: {
						userId,
						role: "DICTATOR",
						requiresApprovalDefault: false,
					},
				},
			},
			select: { id: true, name: true },
		});

		await prisma.user.update({
			where: { id: userId },
			data: { lastHouseholdId: household.id },
		});

		return { household };
	}),

	// Select active household
	select: protectedProcedure.input(selectHouseholdSchema).mutation(async ({ ctx, input }) => {
		const membership = await prisma.householdMember.findFirst({
			where: { userId: ctx.session.user.id, householdId: input.householdId },
			select: { householdId: true },
		});

		if (!membership) {
			throw new TRPCError({ code: "FORBIDDEN", message: "Forbidden" });
		}

		await prisma.user.update({
			where: { id: ctx.session.user.id },
			data: { lastHouseholdId: input.householdId },
		});

		return { ok: true };
	}),

	// Join household with invite code
	join: protectedProcedure.input(joinSchema).mutation(async ({ ctx, input }) => {
		const userId = ctx.session.user.id;

		// Rate limiting
		const rateKey = `join:${userId}`;
		const rateCheck = checkRateLimit(rateKey);
		if (!rateCheck.ok) {
			const retryAfterSeconds = Math.max(1, Math.ceil((rateCheck.resetAt - Date.now()) / 1000));
			throw new TRPCError({
				code: "TOO_MANY_REQUESTS",
				message: `Too many attempts, try again in ${retryAfterSeconds} seconds`,
			});
		}

		const code = input.code.trim().toUpperCase();
		const invite = await prisma.householdInvite.findFirst({
			where: { code, status: "PENDING" },
			select: { id: true, householdId: true, role: true, expiresAt: true },
		});

		if (!invite) {
			throw new TRPCError({ code: "NOT_FOUND", message: "Invalid invite code" });
		}

		const now = new Date();
		if (invite.expiresAt < now) {
			await prisma.householdInvite.update({
				where: { id: invite.id },
				data: { status: "EXPIRED", respondedAt: now },
			});
			throw new TRPCError({ code: "BAD_REQUEST", message: "Invite expired" });
		}

		await prisma.$transaction(async (tx) => {
			await tx.householdMember.upsert({
				where: {
					householdId_userId: {
						householdId: invite.householdId,
						userId,
					},
				},
				update: {},
				create: {
					householdId: invite.householdId,
					userId,
					role: invite.role,
				},
			});

			await tx.householdInvite.update({
				where: { id: invite.id },
				data: { status: "ACCEPTED", respondedAt: now },
			});

			await tx.user.update({
				where: { id: userId },
				data: { lastHouseholdId: invite.householdId },
			});
		});

		return { ok: true };
	}),

	// Get household members
	getMembers: householdProcedure.query(async ({ ctx }) => {
		const members = await prisma.householdMember.findMany({
			where: { householdId: ctx.household.id },
			select: {
				id: true,
				userId: true,
				role: true,
				requiresApprovalDefault: true,
				joinedAt: true,
				user: { select: { name: true, email: true, image: true } },
			},
			orderBy: { joinedAt: "asc" },
		});

		return { members };
	}),

	// Update household member
	updateMember: dictatorProcedure.input(updateMemberSchema).mutation(async ({ ctx, input }) => {
		const { id, ...updates } = input;

		const member = await prisma.householdMember.findFirst({
			where: { id, householdId: ctx.household.id },
			select: { id: true, role: true },
		});

		if (!member) {
			throw new TRPCError({ code: "NOT_FOUND", message: "Member not found" });
		}

		if (updates.role && updates.role !== member.role && member.role === "DICTATOR" && updates.role !== "DICTATOR") {
			const dictatorCount = await prisma.householdMember.count({
				where: { householdId: ctx.household.id, role: "DICTATOR" },
			});
			if (dictatorCount <= 1) {
				throw new TRPCError({ code: "BAD_REQUEST", message: "Household must have at least one dictator" });
			}
		}

		const updated = await prisma.householdMember.update({
			where: { id },
			data: {
				role: updates.role,
				requiresApprovalDefault: updates.requiresApprovalDefault,
			},
			select: {
				id: true,
				userId: true,
				role: true,
				requiresApprovalDefault: true,
			},
		});

		return { member: updated };
	}),

	// Get invites
	getInvites: dictatorProcedure.query(async ({ ctx }) => {
		const now = new Date();
		await prisma.householdInvite.updateMany({
			where: {
				householdId: ctx.household.id,
				status: "PENDING",
				expiresAt: { lt: now },
			},
			data: { status: "EXPIRED", respondedAt: now },
		});

		const invites = await prisma.householdInvite.findMany({
			where: {
				householdId: ctx.household.id,
				status: { in: ["PENDING", "EXPIRED"] },
			},
			select: {
				id: true,
				code: true,
				role: true,
				status: true,
				invitedAt: true,
				expiresAt: true,
				invitedBy: { select: { name: true, email: true } },
			},
			orderBy: { invitedAt: "desc" },
		});

		return { invites };
	}),

	// Create invite
	createInvite: dictatorProcedure.input(inviteSchema).mutation(async ({ ctx, input }) => {
		const role = input.role ?? "DOER";
		let invite = null;
		let attempts = 0;

		while (!invite && attempts < 5) {
			attempts += 1;
			const code = generateCode();
			const existing = await prisma.householdInvite.findFirst({
				where: { code },
				select: { id: true },
			});
			if (existing) {
				continue;
			}
			invite = await prisma.householdInvite.create({
				data: {
					householdId: ctx.household.id,
					code,
					role,
					invitedById: ctx.session.user.id,
					expiresAt: addExpiry(),
				},
				select: {
					id: true,
					code: true,
					role: true,
					status: true,
					invitedAt: true,
					expiresAt: true,
					invitedBy: { select: { name: true, email: true } },
				},
			});
		}

		if (!invite) {
			throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Unable to generate invite code" });
		}

		return { invite };
	}),

	// Manage invite (revoke/resend)
	manageInvite: dictatorProcedure.input(inviteActionSchema).mutation(async ({ ctx, input }) => {
		const { id, action } = input;

		const invite = await prisma.householdInvite.findUnique({
			where: { id },
			select: {
				id: true,
				code: true,
				role: true,
				status: true,
				householdId: true,
			},
		});

		if (!invite) {
			throw new TRPCError({ code: "NOT_FOUND", message: "Invite not found" });
		}

		if (invite.householdId !== ctx.household.id) {
			throw new TRPCError({ code: "FORBIDDEN", message: "Forbidden" });
		}

		if (!["PENDING", "EXPIRED"].includes(invite.status)) {
			throw new TRPCError({
				code: "BAD_REQUEST",
				message: action === "resend" ? "Invite cannot be resent" : "Invite cannot be revoked",
			});
		}

		if (action === "resend") {
			let updated = null;
			let attempts = 0;

			while (!updated && attempts < 5) {
				attempts += 1;
				const code = generateCode();
				const existing = await prisma.householdInvite.findFirst({
					where: { code },
					select: { id: true },
				});
				if (existing) {
					continue;
				}
				updated = await prisma.householdInvite.update({
					where: { id },
					data: {
						code,
						status: "PENDING",
						invitedAt: new Date(),
						expiresAt: addExpiry(),
						respondedAt: null,
					},
					select: {
						id: true,
						code: true,
						role: true,
						status: true,
						invitedAt: true,
						expiresAt: true,
					},
				});
			}

			if (!updated) {
				throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Unable to regenerate invite code" });
			}

			return { invite: updated };
		}

		if (action === "revoke") {
			await prisma.householdInvite.update({
				where: { id },
				data: { status: "REVOKED", respondedAt: new Date() },
			});

			return { ok: true };
		}

		throw new TRPCError({ code: "BAD_REQUEST", message: "Unsupported action" });
	}),
});
