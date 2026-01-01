import "server-only";

import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { dictatorProcedure, householdProcedure, router } from "@/server/trpc";

const timeRegex = /^([0-1][0-9]|2[0-3]):[0-5][0-9]$/;

const householdConfigSchema = z.object({
	dailyReminderEnabled: z.boolean().optional(),
	dailyReminderTime: z.string().regex(timeRegex).optional().nullable(),
	weeklyReminderEnabled: z.boolean().optional(),
	weeklyReminderDay: z.number().int().min(0).max(6).optional().nullable(),
	weeklyReminderTime: z.string().regex(timeRegex).optional().nullable(),
	intervalReminderEnabled: z.boolean().optional(),
	intervalReminderDays: z.number().int().min(1).max(90).optional().nullable(),
	eventReminderEnabled: z.boolean().optional(),
	eventReminderDays: z.number().int().min(1).max(90).optional().nullable(),
});

const userOverrideSchema = z.object({
	isPaused: z.boolean().optional(),
	pausedUntil: z.date().optional().nullable(),
	dailyReminderEnabled: z.boolean().optional().nullable(),
	dailyReminderTime: z.string().regex(timeRegex).optional().nullable(),
	weeklyReminderEnabled: z.boolean().optional().nullable(),
	weeklyReminderDay: z.number().int().min(0).max(6).optional().nullable(),
	weeklyReminderTime: z.string().regex(timeRegex).optional().nullable(),
	intervalReminderEnabled: z.boolean().optional().nullable(),
	intervalReminderDays: z.number().int().min(1).max(90).optional().nullable(),
	eventReminderEnabled: z.boolean().optional().nullable(),
	eventReminderDays: z.number().int().min(1).max(90).optional().nullable(),
});

const snoozeSchema = z.object({
	hours: z.number().int().min(1).max(168).optional(), // Max 1 week
	days: z.number().int().min(1).max(30).optional(),
});

export const remindersRouter = router({
	// Get household default config
	getHouseholdConfig: householdProcedure.query(async ({ ctx }) => {
		const config = await prisma.householdReminderConfig.findUnique({
			where: { householdId: ctx.household.id },
		});
		return { config };
	}),

	// Update household defaults (DICTATOR only)
	updateHouseholdConfig: dictatorProcedure.input(householdConfigSchema).mutation(async ({ ctx, input }) => {
		const config = await prisma.householdReminderConfig.upsert({
			where: { householdId: ctx.household.id },
			create: {
				householdId: ctx.household.id,
				...input,
			},
			update: input,
		});
		return { config };
	}),

	// Get user's override settings
	getUserOverride: householdProcedure.query(async ({ ctx }) => {
		const override = await prisma.userReminderOverride.findUnique({
			where: {
				userId_householdId: {
					userId: ctx.session.user.id,
					householdId: ctx.household.id,
				},
			},
		});
		return { override };
	}),

	// Update user's override settings
	updateUserOverride: householdProcedure.input(userOverrideSchema).mutation(async ({ ctx, input }) => {
		const override = await prisma.userReminderOverride.upsert({
			where: {
				userId_householdId: {
					userId: ctx.session.user.id,
					householdId: ctx.household.id,
				},
			},
			create: {
				userId: ctx.session.user.id,
				householdId: ctx.household.id,
				...input,
			},
			update: input,
		});
		return { override };
	}),

	// Snooze current reminder
	snooze: householdProcedure.input(snoozeSchema).mutation(async ({ ctx, input }) => {
		const now = new Date();
		const snoozedUntil = new Date(now);

		if (input.hours) {
			snoozedUntil.setHours(snoozedUntil.getHours() + input.hours);
		}
		if (input.days) {
			snoozedUntil.setDate(snoozedUntil.getDate() + input.days);
		}

		// Update or create override with pause
		await prisma.userReminderOverride.upsert({
			where: {
				userId_householdId: {
					userId: ctx.session.user.id,
					householdId: ctx.household.id,
				},
			},
			create: {
				userId: ctx.session.user.id,
				householdId: ctx.household.id,
				isPaused: true,
				pausedUntil: snoozedUntil,
			},
			update: {
				isPaused: true,
				pausedUntil: snoozedUntil,
			},
		});

		return { snoozedUntil };
	}),

	// Dismiss reminder (just marks as read, doesn't pause future)
	dismiss: householdProcedure.mutation(async ({ ctx }) => {
		// Find most recent reminder
		const recentLog = await prisma.reminderSendLog.findFirst({
			where: {
				userId: ctx.session.user.id,
				householdId: ctx.household.id,
				status: "SENT",
			},
			orderBy: { sentAt: "desc" },
		});

		if (recentLog) {
			await prisma.reminderSendLog.update({
				where: { id: recentLog.id },
				data: {
					status: "DISMISSED",
					dismissedAt: new Date(),
				},
			});
		}

		return { ok: true };
	}),

	// Pause all reminders temporarily
	pauseAll: householdProcedure
		.input(z.object({ days: z.number().int().min(1).max(90) }))
		.mutation(async ({ ctx, input }) => {
			const pausedUntil = new Date();
			pausedUntil.setDate(pausedUntil.getDate() + input.days);

			await prisma.userReminderOverride.upsert({
				where: {
					userId_householdId: {
						userId: ctx.session.user.id,
						householdId: ctx.household.id,
					},
				},
				create: {
					userId: ctx.session.user.id,
					householdId: ctx.household.id,
					isPaused: true,
					pausedUntil,
				},
				update: {
					isPaused: true,
					pausedUntil,
				},
			});

			return { pausedUntil };
		}),

	// Resume reminders
	resume: householdProcedure.mutation(async ({ ctx }) => {
		await prisma.userReminderOverride.upsert({
			where: {
				userId_householdId: {
					userId: ctx.session.user.id,
					householdId: ctx.household.id,
				},
			},
			create: {
				userId: ctx.session.user.id,
				householdId: ctx.household.id,
				isPaused: false,
				pausedUntil: null,
			},
			update: {
				isPaused: false,
				pausedUntil: null,
			},
		});

		return { ok: true };
	}),
});
