import "server-only";

type RateLimitEntry = {
	count: number;
	resetAt: number;
};

export type RateLimitResult = {
	ok: boolean;
	resetAt: number;
};

type HeadersLike = Headers | Record<string, string | string[] | undefined> | Record<string, unknown>;

export type RequestLike = {
	headers?: HeadersLike | null;
};

declare global {
	var rateLimitStore: Map<string, RateLimitEntry> | undefined;
	var rateLimitLastCleanup: number | undefined;
}

const store = globalThis.rateLimitStore ?? new Map<string, RateLimitEntry>();

if (!globalThis.rateLimitStore) {
	globalThis.rateLimitStore = store;
}

const CLEANUP_INTERVAL_MS = 5 * 60 * 1000; // 5 minutes

const cleanupExpiredEntries = () => {
	const now = Date.now();

	if (globalThis.rateLimitLastCleanup && now - globalThis.rateLimitLastCleanup < CLEANUP_INTERVAL_MS) {
		return;
	}

	globalThis.rateLimitLastCleanup = now;

	for (const [key, entry] of store.entries()) {
		if (entry.resetAt <= now) {
			store.delete(key);
		}
	}
};

export const checkRateLimit = (options: { key: string; windowMs: number; max: number }): RateLimitResult => {
	const { key, windowMs, max } = options;

	cleanupExpiredEntries();

	const now = Date.now();
	const entry = store.get(key);
	if (!entry || entry.resetAt <= now) {
		const resetAt = now + windowMs;
		store.set(key, { count: 1, resetAt });
		return { ok: true, resetAt };
	}

	if (entry.count >= max) {
		return { ok: false, resetAt: entry.resetAt };
	}

	entry.count += 1;
	return { ok: true, resetAt: entry.resetAt };
};

export const getHeaderValue = (options: { req: RequestLike | null | undefined; key: string }): string | undefined => {
	const { req, key } = options;
	if (!req || typeof req !== "object") {
		return undefined;
	}

	const headers = req.headers;
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

export const getClientIp = (req: RequestLike | null | undefined): string | undefined => {
	const forwarded = getHeaderValue({ req, key: "x-forwarded-for" });
	if (forwarded) {
		return forwarded.split(",")[0]?.trim() || undefined;
	}

	return getHeaderValue({ req, key: "x-real-ip" }) ?? undefined;
};
