import { getServerSession } from "next-auth";
import { NextResponse } from "next/server";
import { z } from "zod";

import { authOptions } from "@/lib/auth";
import {
	DURATION_KEYS,
	type DurationKey,
	findPreset,
	getBucketPoints,
} from "@/lib/points";
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
	.refine(
		(data) => Boolean(data.presetKey) !== Boolean(data.presetId),
		{
			message: "Provide presetKey or presetId",
			path: ["presetKey"],
		},
	);

const timedSchema = z.object({
	type: z.literal("timed"),
	bucket: z.enum(DURATION_KEYS),
	description: z
		.string()
		.min(1, "Describe what you did")
		.max(160, "Keep the note short"),
	durationMinutes: z.number().int().positive().max(120).optional(),
});

const payloadSchema = z.union([presetSchema, timedSchema]);

export async function POST(req: Request) {
	const session = await getServerSession(authOptions);

	if (!session?.user?.id) {
		return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
	}

	const json = await req.json();
	const parsed = payloadSchema.safeParse(json);

	if (!parsed.success) {
		return NextResponse.json(
			{ error: "Invalid payload", details: parsed.error.flatten() },
			{ status: 400 },
		);
	}

	const userId = session.user.id;
	const actorLabel = session.user.name ?? session.user.email ?? "Someone";

	const notifyTask = async (description: string, points: number) => {
		if (!isPushConfigured()) {
			return;
		}

		const trimmed =
			description.length > 96 ? `${description.slice(0, 93)}...` : description;

		try {
			await broadcastPush({
				title: "New task logged",
				body: `${actorLabel} logged ${points} pts: ${trimmed}`,
				url: "/",
				icon: "/icon-192.png",
				badge: "/icon-192.png",
			});
		} catch (error) {
			console.error("[push] notify failed", error);
		}
	};

	try {
		const payload = parsed.data;
		if (payload.type === "preset") {
			if (payload.presetId) {
				const preset = await prisma.presetTask.findFirst({
					where: {
						id: payload.presetId,
						OR: [{ isShared: true }, { createdById: userId }],
					},
					select: { id: true, label: true, bucket: true },
				});

				if (!preset) {
					return NextResponse.json(
						{ error: "Unknown preset task" },
						{ status: 400 },
					);
				}

				const entry = await prisma.pointLog.create({
					data: {
						userId,
						kind: "PRESET",
						duration: preset.bucket,
						points: getBucketPoints(preset.bucket as DurationKey),
						description: payload.description?.trim() || preset.label,
						presetId: preset.id,
					},
				});
				await notifyTask(entry.description, entry.points);

				const total = await prisma.pointLog.aggregate({
					where: { userId, revertedAt: null },
					_sum: { points: true },
				});

				return NextResponse.json(
					{ entry, totalPoints: total._sum.points ?? 0 },
					{ status: 201 },
				);
			}

			const preset = findPreset(payload.presetKey ?? "");
			if (!preset) {
				return NextResponse.json(
					{ error: "Unknown preset task" },
					{ status: 400 },
				);
			}

			const entry = await prisma.pointLog.create({
				data: {
					userId,
					kind: "PRESET",
					duration: preset.bucket,
					points: getBucketPoints(preset.bucket),
					description: payload.description?.trim() || preset.label,
					presetKey: preset.key,
				},
			});
			await notifyTask(entry.description, entry.points);

			const total = await prisma.pointLog.aggregate({
				where: { userId, revertedAt: null },
				_sum: { points: true },
			});

			return NextResponse.json(
				{ entry, totalPoints: total._sum.points ?? 0 },
				{ status: 201 },
			);
		}

		const entry = await prisma.pointLog.create({
			data: {
				userId,
				kind: "TIMED",
				duration: payload.bucket,
				durationMinutes: payload.durationMinutes,
				points: getBucketPoints(payload.bucket),
				description: payload.description.trim(),
			},
		});
		await notifyTask(entry.description, entry.points);

		const total = await prisma.pointLog.aggregate({
			where: { userId, revertedAt: null },
			_sum: { points: true },
		});

		return NextResponse.json(
			{ entry, totalPoints: total._sum.points ?? 0 },
			{ status: 201 },
		);
	} catch (error) {
		console.error("[logs:POST]", error);
		return NextResponse.json({ error: "Failed to log task" }, { status: 500 });
	}
}
