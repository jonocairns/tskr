export const appErrorCodes = [
	"INVALID_INPUT",
	"UNAUTHORIZED",
	"FORBIDDEN",
	"NOT_FOUND",
	"CONFLICT",
	"RATE_LIMITED",
	"INTERNAL_SERVER_ERROR",
] as const;

export type AppErrorCode = (typeof appErrorCodes)[number];

const appErrorCodeSet = new Set<AppErrorCode>(appErrorCodes);

export const isAppErrorCode = (value: unknown): value is AppErrorCode =>
	typeof value === "string" && appErrorCodeSet.has(value as AppErrorCode);

export const getFallbackAppErrorCode = (trpcCode?: string): AppErrorCode => {
	switch (trpcCode) {
		case "BAD_REQUEST":
		case "PARSE_ERROR":
		case "UNPROCESSABLE_CONTENT":
			return "INVALID_INPUT";
		case "UNAUTHORIZED":
			return "UNAUTHORIZED";
		case "FORBIDDEN":
			return "FORBIDDEN";
		case "NOT_FOUND":
			return "NOT_FOUND";
		case "CONFLICT":
			return "CONFLICT";
		case "TOO_MANY_REQUESTS":
			return "RATE_LIMITED";
		default:
			return "INTERNAL_SERVER_ERROR";
	}
};
