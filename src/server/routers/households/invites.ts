import "server-only";

import { randomBytes } from "node:crypto";

import { TRPCError } from "@trpc/server";
import { z } from "zod";

import { prisma } from "@/lib/prisma";
import { dictatorProcedure, router } from "@/server/trpc";
import { config } from "@/server-config";

const addExpiry = () => {
	const expiresAt = new Date();
	expiresAt.setDate(expiresAt.getDate() + config.inviteExpiryDays);
	return expiresAt;
};

const generateCode = () => randomBytes(8).toString("hex").toUpperCase();

const inviteSchema = z.object({
	householdId: z.string().min(1),
	role: z.enum(["DICTATOR", "APPROVER", "DOER"]).optional(),
});

const inviteActionSchema = z.object({
	householdId: z.string().min(1),
	id: z.string(),
	action: z.enum(["revoke", "resend"]),
});

const getInvitesSchema = z.object({
	householdId: z.string().min(1),
});

export const householdInvitesRouter = router({
	getInvites: dictatorProcedure(getInvitesSchema).query(async ({ ctx }) => {
		const householdId = ctx.household.id;

		const now = new Date();
		await prisma.householdInvite.updateMany({
			where: {
				householdId,
				status: "PENDING",
				expiresAt: { lt: now },
			},
			data: { status: "EXPIRED", respondedAt: now },
		});

		const invites = await prisma.householdInvite.findMany({
			where: {
				householdId,
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
	createInvite: dictatorProcedure(inviteSchema).mutation(async ({ ctx, input }) => {
		const householdId = ctx.household.id;
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
					householdId,
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
	manageInvite: dictatorProcedure(inviteActionSchema).mutation(async ({ ctx, input }) => {
		const householdId = ctx.household.id;
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

		if (invite.householdId !== householdId) {
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
