import { TRPCClientError } from "@trpc/client";
import type { AnyRouter } from "@trpc/server";

import { type AppErrorCode, getFallbackAppErrorCode, isAppErrorCode } from "@/lib/appErrorCodes";

type Translator = (key: string, options?: Record<string, unknown>) => string;

const getTrpcAppErrorCode = (error: TRPCClientError<AnyRouter>): AppErrorCode => {
	const rawCode = (error.data as { appErrorCode?: unknown } | undefined)?.appErrorCode;
	if (isAppErrorCode(rawCode)) {
		return rawCode;
	}

	const trpcCode = (error.data as { code?: string } | undefined)?.code;
	return getFallbackAppErrorCode(trpcCode);
};

export const getAppErrorCode = (error: unknown): AppErrorCode | null => {
	if (error instanceof TRPCClientError) {
		return getTrpcAppErrorCode(error);
	}
	return null;
};

const getTranslatedAppError = (code: AppErrorCode, t: Translator) => {
	switch (code) {
		case "INVALID_INPUT":
			return t("INVALID_INPUT");
		case "UNAUTHORIZED":
			return t("UNAUTHORIZED");
		case "FORBIDDEN":
			return t("FORBIDDEN");
		case "NOT_FOUND":
			return t("NOT_FOUND");
		case "CONFLICT":
			return t("CONFLICT");
		case "RATE_LIMITED":
			return t("RATE_LIMITED");
		case "INTERNAL_SERVER_ERROR":
			return t("INTERNAL_SERVER_ERROR");
		default:
			return t("INTERNAL_SERVER_ERROR");
	}
};

export const getErrorMessage = (error: unknown, t: Translator, appErrorCode?: AppErrorCode | null) => {
	const resolvedCode = appErrorCode ?? getAppErrorCode(error);
	if (resolvedCode) {
		return getTranslatedAppError(resolvedCode, t);
	}
	if (error instanceof Error && error.message) {
		return error.message;
	}
	return t("An unexpected error occurred");
};
