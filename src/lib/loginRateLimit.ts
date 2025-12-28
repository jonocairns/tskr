import "server-only";

const LOGIN_RATE_LIMIT_WINDOW_MS = 10 * 60_000;
const LOGIN_RATE_LIMIT_MAX = 10;

type RateLimitEntry = {
	count: number;
	resetAt: number;
};

declare global {
	var loginRateLimit: Map<string, RateLimitEntry> | undefined;
}

const loginRateLimitStore = globalThis.loginRateLimit ?? new Map<string, RateLimitEntry>();

if (!globalThis.loginRateLimit) {
	globalThis.loginRateLimit = loginRateLimitStore;
}

const checkRateLimit = (key: string) => {
	const now = Date.now();
	const entry = loginRateLimitStore.get(key);
	if (!entry || entry.resetAt <= now) {
		const resetAt = now + LOGIN_RATE_LIMIT_WINDOW_MS;
		loginRateLimitStore.set(key, { count: 1, resetAt });
		return { ok: true, resetAt };
	}

	if (entry.count >= LOGIN_RATE_LIMIT_MAX) {
		return { ok: false, resetAt: entry.resetAt };
	}

	entry.count += 1;
	return { ok: true, resetAt: entry.resetAt };
};

const getHeaderValue = (req: unknown, key: string) => {
	if (!req || typeof req !== "object") {
		return undefined;
	}

	const headers = (req as { headers?: unknown }).headers;
	if (!headers) {
		return undefined;
	}

	if (typeof (headers as Headers).get === "function") {
		return (headers as Headers).get(key) ?? undefined;
	}

	if (typeof headers === "object" && headers) {
		const value =
			(headers as Record<string, string | string[] | undefined>)[key] ??
			(headers as Record<string, string | string[] | undefined>)[key.toLowerCase()];
		if (Array.isArray(value)) {
			return value.join(",");
		}
		if (typeof value === "string") {
			return value;
		}
	}

	return undefined;
};

const getClientIp = (req: unknown) => {
	const forwarded = getHeaderValue(req, "x-forwarded-for");
	if (forwarded) {
		return forwarded.split(",")[0]?.trim() || undefined;
	}

	return getHeaderValue(req, "x-real-ip") ?? undefined;
};

export const isLoginRateLimited = (email: string, req: unknown) => {
	const ip = getClientIp(req);
	const rateKeys = [`login:email:${email}`, ...(ip ? [`login:ip:${ip}`, `login:ip:${ip}:email:${email}`] : [])];
	return rateKeys.some((key) => !checkRateLimit(key).ok);
};
