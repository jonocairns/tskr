import "server-only";

import {
	checkRateLimit as checkRateLimitBase,
	getClientIp,
	getHeaderValue,
	type RateLimitResult,
	type RequestLike,
} from "@/lib/rateLimit";

const LOGIN_RATE_LIMIT_WINDOW_MS = 10 * 60_000;
const LOGIN_RATE_LIMIT_MAX = 10;

type LoginRateLimitKey = `login:${string}`;

export const checkRateLimit = (key: LoginRateLimitKey): RateLimitResult => {
	return checkRateLimitBase({ key, windowMs: LOGIN_RATE_LIMIT_WINDOW_MS, max: LOGIN_RATE_LIMIT_MAX });
};

export { getClientIp, getHeaderValue };

export const isLoginRateLimited = (email: string, req: RequestLike | null | undefined): boolean => {
	const ip = getClientIp(req);
	const rateKeys: LoginRateLimitKey[] = [
		`login:email:${email}` as const,
		...(ip
			? ([`login:ip:${ip}`, `login:ip:${ip}:email:${email}`] as const satisfies readonly LoginRateLimitKey[])
			: []),
	];
	return rateKeys.some((key) => !checkRateLimit(key).ok);
};
