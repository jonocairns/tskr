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

const CLEANUP_INTERVAL_MS = 5 * 60 * 1000; // 5 minutes

globalThis.rateLimitStore ??= new Map<string, RateLimitEntry>();
const store = globalThis.rateLimitStore;

const cleanupExpiredEntries = () => {
	const now = Date.now();
	const lastCleanup = globalThis.rateLimitLastCleanup ?? 0;

	if (now - lastCleanup < CLEANUP_INTERVAL_MS) {
		return;
	}

	globalThis.rateLimitLastCleanup = now;

	for (const [key, entry] of store.entries()) {
		if (entry.resetAt <= now) {
			store.delete(key);
		}
	}
};

export const checkRateLimit = (options: { key: string; windowMs: number; max: number }) => {
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

const extractHeaderValue = (headers: HeadersLike, key: string) => {
	if (typeof (headers as Headers).get === "function") {
		return (headers as Headers).get(key) ?? undefined;
	}

	const record = headers as Record<string, string | string[] | undefined>;
	const value = record[key] ?? record[key.toLowerCase()];

	if (Array.isArray(value)) {
		return value.join(",");
	}

	if (typeof value === "string") {
		return value;
	}

	return undefined;
};

export const getHeaderValue = (options: { req: RequestLike | null | undefined; key: string }) => {
	const { req, key } = options;

	if (!req?.headers) {
		return undefined;
	}

	return extractHeaderValue(req.headers, key);
};

export const getClientIp = (req: RequestLike | null | undefined) => {
	const forwarded = getHeaderValue({ req, key: "x-forwarded-for" });

	if (forwarded) {
		return forwarded.split(",")[0]?.trim() || undefined;
	}

	return getHeaderValue({ req, key: "x-real-ip" });
};
