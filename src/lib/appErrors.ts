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

export const getErrorMessage = (error: unknown, t: Translator, appErrorCode?: AppErrorCode | null) => {
	const resolvedCode = appErrorCode ?? getAppErrorCode(error);
	if (resolvedCode) {
		return t(resolvedCode, { ns: "errors" });
	}
	if (error instanceof Error && error.message) {
		return error.message;
	}
	return t("An unexpected error occurred");
};
