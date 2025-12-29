import type { Prisma } from "@prisma/client";
import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { z } from "zod";

import { authOptions } from "@/lib/auth";
import { buildAuditEntries } from "@/lib/dashboard/buildAuditEntries";
import { getActiveHouseholdMembership } from "@/lib/households";
import { DURATION_KEYS, type DurationKey, findPreset, getBucketPoints } from "@/lib/points";
import { prisma } from "@/lib/prisma";
import { broadcastPush, isPushConfigured } from "@/lib/push";

export const runtime = "nodejs";

const presetSchema = z
	.object({
		type: z.literal("preset"),
		presetKey: z.string().min(1).optional(),
		presetId: z.string().min(1).optional(),
		description: z.string().max(120).optional(),
	})
	.refine((data) => Boolean(data.presetKey) !== Boolean(data.presetId), {
		message: "Provide presetKey or presetId",
		path: ["presetKey"],
	});

const timedSchema = z.object({
	type: z.literal("timed"),
	bucket: z.enum(DURATION_KEYS),
	description: z.string().min(1, "Describe what you did").max(160, "Keep the note short"),
	durationMinutes: z.number().int().positive().max(120).optional(),
});

const payloadSchema = z.union([presetSchema, timedSchema]);
const historyQuerySchema = z.object({
	offset: z.coerce.number().int().min(0).default(0),
	limit: z.coerce.number().int().min(1).max(50).default(10),
});

export async function GET(req: Request) {
	const session = await getServerSession(authOptions);

	if (!session?.user?.id) {
		return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
	}

	const active = await getActiveHouseholdMembership(session.user.id, session.user.householdId ?? null);
	if (!active) {
		return NextResponse.json({ error: "Household not found" }, { status: 403 });
	}

	const { searchParams } = new URL(req.url);
	const parsed = historyQuerySchema.safeParse({
		offset: searchParams.get("offset"),
		limit: searchParams.get("limit"),
	});
	if (!parsed.success) {
		return NextResponse.json({ error: "Invalid query", details: parsed.error.flatten() }, { status: 400 });
	}

	const take = parsed.data.limit + 1;
	const logs = await prisma.pointLog.findMany({
		where: { householdId: active.householdId },
		include: {
			user: { select: { id: true, name: true, email: true } },
		},
		orderBy: { createdAt: "desc" },
		skip: parsed.data.offset,
		take,
	});

	const hasMore = logs.length > parsed.data.limit;
	const trimmedLogs = hasMore ? logs.slice(0, parsed.data.limit) : logs;

	return NextResponse.json({
		entries: buildAuditEntries(trimmedLogs),
		hasMore,
	});
}

export async function POST(req: Request) {
	const session = await getServerSession(authOptions);

	if (!session?.user?.id) {
		return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
	}

	const json = await req.json();
	const parsed = payloadSchema.safeParse(json);

	if (!parsed.success) {
		return NextResponse.json({ error: "Invalid payload", details: parsed.error.flatten() }, { status: 400 });
	}

	const userId = session.user.id;
	const actorLabel = session.user.name ?? session.user.email ?? "Someone";
	const active = await getActiveHouseholdMembership(userId, session.user.householdId ?? null);
	if (!active) {
		return NextResponse.json({ error: "Household not found" }, { status: 403 });
	}

	const { householdId, membership } = active;

	const notifyTask = async (description: string, points: number) => {
		if (!isPushConfigured()) {
			return;
		}

		const trimmed = description.length > 96 ? `${description.slice(0, 93)}...` : description;

		try {
			await broadcastPush(
				{
					title: "Task logged",
					body: `${actorLabel} logged ${points} points for "${trimmed}"`,
					url: "/",
					icon: "/icon-192.png",
					badge: "/icon-192.png",
				},
				{ householdId, excludeUserId: userId },
			);
		} catch (error) {
			console.error("[push] notify failed", error);
		}
	};

	const resolveRequiresApproval = (override?: string | null) => {
		if (override === "REQUIRE") {
			return true;
		}
		if (override === "SKIP") {
			return false;
		}
		return membership.requiresApprovalDefault;
	};

	const getTotalPoints = async () => {
		const total = await prisma.pointLog.aggregate({
			where: {
				userId,
				householdId,
				revertedAt: null,
				status: "APPROVED",
			},
			_sum: { points: true },
		});
		return total._sum.points ?? 0;
	};

	const createEntry = async (data: Prisma.PointLogUncheckedCreateInput) => {
		const entry = await prisma.pointLog.create({ data });
		await notifyTask(entry.description, entry.points);
		const totalPoints = await getTotalPoints();

		return NextResponse.json({ entry, totalPoints }, { status: 201 });
	};

	try {
		const payload = parsed.data;
		if (payload.type === "preset") {
			if (payload.presetId) {
				const preset = await prisma.presetTask.findFirst({
					where: {
						id: payload.presetId,
						householdId,
						OR: [{ isShared: true }, { createdById: userId }],
					},
					select: {
						id: true,
						label: true,
						bucket: true,
						approvalOverride: true,
					},
				});

				if (!preset) {
					return NextResponse.json({ error: "Unknown preset task" }, { status: 400 });
				}

				const bucket = DURATION_KEYS.includes(preset.bucket as DurationKey) ? (preset.bucket as DurationKey) : null;

				if (!bucket) {
					return NextResponse.json({ error: "Unknown preset task" }, { status: 400 });
				}

				const requiresApproval = resolveRequiresApproval(preset.approvalOverride);
				const status = requiresApproval ? "PENDING" : "APPROVED";
				return createEntry({
					householdId,
					userId,
					kind: "PRESET",
					duration: bucket,
					points: getBucketPoints(bucket),
					description: payload.description?.trim() || preset.label,
					presetId: preset.id,
					status,
				});
			}

			const preset = findPreset(payload.presetKey ?? "");
			if (!preset) {
				return NextResponse.json({ error: "Unknown preset task" }, { status: 400 });
			}

			const requiresApproval = resolveRequiresApproval(null);
			const status = requiresApproval ? "PENDING" : "APPROVED";
			return createEntry({
				householdId,
				userId,
				kind: "PRESET",
				duration: preset.bucket,
				points: getBucketPoints(preset.bucket),
				description: payload.description?.trim() || preset.label,
				presetKey: preset.key,
				status,
			});
		}

		const requiresApproval = resolveRequiresApproval(null);
		const status = requiresApproval ? "PENDING" : "APPROVED";
		return createEntry({
			householdId,
			userId,
			kind: "TIMED",
			duration: payload.bucket,
			durationMinutes: payload.durationMinutes,
			points: getBucketPoints(payload.bucket),
			description: payload.description.trim(),
			status,
		});
	} catch (error) {
		console.error("[logs:POST]", error);
		return NextResponse.json({ error: "Failed to log task" }, { status: 500 });
	}
}
