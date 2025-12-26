import { getServerSession } from "next-auth";
import { NextResponse } from "next/server";
import { z } from "zod";

import { authOptions } from "@/lib/auth";
import { getActiveHouseholdMembership } from "@/lib/households";
import { prisma } from "@/lib/prisma";

type Params = {
	params: { id: string } | Promise<{ id: string }>;
};

const actionSchema = z.object({
	action: z.enum(["approve", "reject", "resubmit", "revert"]).optional(),
});

export async function PATCH(_req: Request, { params }: Params) {
	const session = await getServerSession(authOptions);

	if (!session?.user?.id) {
		return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
	}

	const active = await getActiveHouseholdMembership(
		session.user.id,
		session.user.householdId ?? null,
	);
	if (!active) {
		return NextResponse.json({ error: "Household not found" }, { status: 403 });
	}

	const { householdId, membership } = active;
	const { id } = await Promise.resolve(params);

	if (!id) {
		return NextResponse.json({ error: "Missing log id" }, { status: 400 });
	}

	const json = await _req.json().catch(() => null);
	let action: "approve" | "reject" | "resubmit" | "revert" = "revert";
	if (json !== null) {
		const parsed = actionSchema.safeParse(json);
		if (!parsed.success) {
			return NextResponse.json(
				{ error: "Invalid payload", details: parsed.error.flatten() },
				{ status: 400 },
			);
		}
		if (parsed.data.action) {
			action = parsed.data.action;
		}
	}

	const log = await prisma.pointLog.findFirst({
		where: { id, householdId },
		select: {
			id: true,
			userId: true,
			revertedAt: true,
			status: true,
			kind: true,
		},
	});

	if (!log) {
		return NextResponse.json({ error: "Log not found" }, { status: 404 });
	}

	if (action !== "revert" && log.kind === "REWARD") {
		return NextResponse.json(
			{ error: "Rewards cannot be approved" },
			{ status: 400 },
		);
	}

	if (action === "revert") {
		if (log.revertedAt) {
			return NextResponse.json({ error: "Already reverted" }, { status: 400 });
		}

		await prisma.pointLog.update({
			where: { id },
			data: {
				revertedAt: new Date(),
				revertedById: session.user.id,
			},
		});

		return NextResponse.json({ ok: true });
	}

	if (log.revertedAt) {
		return NextResponse.json(
			{ error: "Log already reverted" },
			{ status: 400 },
		);
	}

	if (action === "approve" || action === "reject") {
		if (membership.role === "DOER") {
			return NextResponse.json({ error: "Forbidden" }, { status: 403 });
		}
		if (action === "approve" && log.userId === session.user.id) {
			return NextResponse.json(
				{ error: "You cannot approve your own tasks" },
				{ status: 403 },
			);
		}
		if (log.status !== "PENDING") {
			return NextResponse.json(
				{ error: "Only pending logs can be updated" },
				{ status: 400 },
			);
		}

		await prisma.pointLog.update({
			where: { id },
			data:
				action === "approve"
					? {
							status: "APPROVED",
							approvedById: session.user.id,
							approvedAt: new Date(),
							rejectedById: null,
							rejectedAt: null,
						}
					: {
							status: "REJECTED",
							rejectedById: session.user.id,
							rejectedAt: new Date(),
							approvedById: null,
							approvedAt: null,
						},
		});

		return NextResponse.json({ ok: true });
	}

	if (action === "resubmit") {
		if (log.status !== "REJECTED") {
			return NextResponse.json(
				{ error: "Only rejected logs can be resubmitted" },
				{ status: 400 },
			);
		}

		if (log.userId !== session.user.id) {
			return NextResponse.json(
				{ error: "Only the log owner can resubmit" },
				{ status: 403 },
			);
		}

		await prisma.pointLog.update({
			where: { id },
			data: {
				status: "PENDING",
				rejectedById: null,
				rejectedAt: null,
				approvedById: null,
				approvedAt: null,
			},
		});

		return NextResponse.json({ ok: true });
	}

	return NextResponse.json({ error: "Unsupported action" }, { status: 400 });
}
