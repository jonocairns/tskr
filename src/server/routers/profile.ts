import { TRPCError } from "@trpc/server";
import { z } from "zod";

import { DEFAULT_LANGUAGE, isSupportedLanguage, normalizeLanguage } from "@/lib/i18nConfig";
import { prisma } from "@/lib/prisma";
import { protectedProcedure, router } from "@/server/trpc";

const updateLanguageSchema = z.object({
	language: z.string().min(2).max(12),
});

export const profileRouter = router({
	get: protectedProcedure.query(async ({ ctx }) => {
		const user = await prisma.user.findUnique({
			where: { id: ctx.session.user.id },
			select: { language: true },
		});

		return { language: user?.language ?? DEFAULT_LANGUAGE };
	}),
	updateLanguage: protectedProcedure.input(updateLanguageSchema).mutation(async ({ ctx, input }) => {
		const normalized = normalizeLanguage(input.language);
		const supported = isSupportedLanguage(normalized);
		if (!supported) {
			throw new TRPCError({
				code: "BAD_REQUEST",
				message: "Unsupported language",
				cause: { appErrorCode: "INVALID_INPUT" },
			});
		}

		const user = await prisma.user.update({
			where: { id: ctx.session.user.id },
			data: { language: normalized },
			select: { language: true },
		});

		return { language: user.language };
	}),
});
