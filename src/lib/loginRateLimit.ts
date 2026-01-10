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

// Type-safe key constructors that enforce correct format
const loginRateLimitKey = {
	email: (email: string): LoginRateLimitKey => `login:email:${email}`,
	ip: (ip: string): LoginRateLimitKey => `login:ip:${ip}`,
	ipEmail: (ip: string, email: string): LoginRateLimitKey => `login:ip:${ip}:email:${email}`,
} as const;

export const checkRateLimit = (key: LoginRateLimitKey): RateLimitResult => {
	return checkRateLimitBase({ key, windowMs: LOGIN_RATE_LIMIT_WINDOW_MS, max: LOGIN_RATE_LIMIT_MAX });
};

export { getClientIp, getHeaderValue };

export const isLoginRateLimited = (email: string, req: RequestLike | null | undefined): boolean => {
	const ip = getClientIp(req);
	const rateKeys: LoginRateLimitKey[] = [
		loginRateLimitKey.email(email),
		...(ip ? [loginRateLimitKey.ip(ip), loginRateLimitKey.ipEmail(ip, email)] : []),
	];
	return rateKeys.some((key) => !checkRateLimit(key).ok);
};
