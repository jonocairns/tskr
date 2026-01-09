import "server-only";

import { checkRateLimit, getClientIp } from "@/lib/rateLimit";

const LOGIN_RATE_LIMIT_WINDOW_MS = 10 * 60_000;
const LOGIN_RATE_LIMIT_MAX = 10;

export const isLoginRateLimited = (email: string, req: unknown) => {
	const ip = getClientIp(req);
	const rateKeys = [`login:email:${email}`, ...(ip ? [`login:ip:${ip}`, `login:ip:${ip}:email:${email}`] : [])];
	return rateKeys.some((key) => !checkRateLimit(key, LOGIN_RATE_LIMIT_WINDOW_MS, LOGIN_RATE_LIMIT_MAX).ok);
};
