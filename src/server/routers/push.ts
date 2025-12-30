import "server-only";

import { TRPCError } from "@trpc/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { broadcastPush, isPushConfigured } from "@/lib/push";
import { householdProcedure, protectedProcedure, publicProcedure, router } from "@/server/trpc";
import { config } from "@/server-config";

const subscriptionSchema = z.object({
	endpoint: z.string().url(),
	keys: z.object({
		p256dh: z.string(),
		auth: z.string(),
	}),
});

const unsubscribeSchema = z.object({
	endpoint: z.string(),
});

export const pushRouter = router({
	getPublicKey: publicProcedure.query(() => {
		const publicKey = config.vapidPublicKey;

		if (!publicKey) {
			throw new TRPCError({ code: "NOT_FOUND", message: "Missing VAPID public key" });
		}

		return { publicKey };
	}),

	subscribe: protectedProcedure.input(subscriptionSchema).mutation(async ({ ctx, input }) => {
		const userId = ctx.session.user.id;
		const { endpoint, keys } = input;

		// Get user agent from context if available
		const userAgent = undefined; // tRPC doesn't expose headers by default

		const existing = await prisma.pushSubscription.findUnique({
			where: { endpoint },
			select: { userId: true },
		});

		if (existing && existing.userId !== userId) {
			throw new TRPCError({ code: "FORBIDDEN", message: "Subscription is registered to another user" });
		}

		await prisma.pushSubscription.upsert({
			where: { endpoint },
			update: {
				userId,
				p256dh: keys.p256dh,
				auth: keys.auth,
				userAgent,
			},
			create: {
				userId,
				endpoint,
				p256dh: keys.p256dh,
				auth: keys.auth,
				userAgent,
			},
		});

		return { ok: true };
	}),

	unsubscribe: protectedProcedure.input(unsubscribeSchema).mutation(async ({ ctx, input }) => {
		const userId = ctx.session.user.id;

		await prisma.pushSubscription.deleteMany({
			where: { endpoint: input.endpoint, userId },
		});

		return { ok: true };
	}),

	test: householdProcedure.mutation(async ({ ctx }) => {
		if (!isPushConfigured()) {
			throw new TRPCError({ code: "BAD_REQUEST", message: "Push is not configured" });
		}

		await broadcastPush(
			{
				title: "tskr test notification",
				body: "This is a test push from tskr.",
				url: "/",
				icon: "/icon-192.png",
				badge: "/icon-192.png",
			},
			{ userId: ctx.session.user.id },
		);

		return { ok: true };
	}),
});
