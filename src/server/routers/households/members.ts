import "server-only";

import { TRPCError } from "@trpc/server";
import { z } from "zod";

import { prisma } from "@/lib/prisma";
import { dictatorProcedure, householdProcedure, router } from "@/server/trpc";

const updateMemberSchema = z
	.object({
		id: z.string(),
		role: z.enum(["DICTATOR", "APPROVER", "DOER"]).optional(),
		requiresApprovalDefault: z.boolean().optional(),
	})
	.refine((data) => data.role !== undefined || data.requiresApprovalDefault !== undefined, {
		message: "No updates provided",
	});

export const householdMembersRouter = router({
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
});
