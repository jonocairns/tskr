import { checkRateLimit, getClientIp, getHeaderValue, isLoginRateLimited } from "../src/lib/loginRateLimit";

const clearRateLimit = () => {
	(globalThis as { loginRateLimit?: Map<string, unknown> }).loginRateLimit?.clear();
};

beforeEach(() => {
	clearRateLimit();
});

test("allows initial attempts", () => {
	expect(isLoginRateLimited("user@example.com", undefined)).toBe(false);
});

test("blocks after too many attempts for the same email", () => {
	for (let i = 0; i < 10; i += 1) {
		expect(isLoginRateLimited("user@example.com", undefined)).toBe(false);
	}
	expect(isLoginRateLimited("user@example.com", undefined)).toBe(true);
});

test("continues blocking until the rate limit window resets", () => {
	for (let i = 0; i < 10; i += 1) {
		expect(checkRateLimit("login:repeat").ok).toBe(true);
	}

	expect(checkRateLimit("login:repeat").ok).toBe(false);
	expect(checkRateLimit("login:repeat").ok).toBe(false);
});

test("blocks after too many attempts from the same ip", () => {
	const req = { headers: { "x-forwarded-for": "203.0.113.10, 10.0.0.1" } };
	for (let i = 0; i < 10; i += 1) {
		expect(isLoginRateLimited(`user${i}@example.com`, req)).toBe(false);
	}
	expect(isLoginRateLimited("another@example.com", req)).toBe(true);
});

test("reads header values from a Headers-like object", () => {
	const headers =
		typeof Headers === "function"
			? new Headers({ "x-real-ip": "203.0.113.5" })
			: { get: (key: string) => (key.toLowerCase() === "x-real-ip" ? "203.0.113.5" : null) };
	const req = { headers };

	expect(getHeaderValue(req, "x-real-ip")).toBe("203.0.113.5");
});

test("reads lowercase header keys from a plain object", () => {
	const req = { headers: { "x-real-ip": "203.0.113.6" } };

	expect(getHeaderValue(req, "X-Real-IP")).toBe("203.0.113.6");
});

test("joins array header values for plain objects", () => {
	const req = { headers: { "x-forwarded-for": ["198.51.100.1", "198.51.100.2"] } };

	expect(getHeaderValue(req, "x-forwarded-for")).toBe("198.51.100.1,198.51.100.2");
});

test("ignores missing header containers", () => {
	expect(getHeaderValue({}, "x-real-ip")).toBeUndefined();
	expect(getHeaderValue({ headers: null }, "x-real-ip")).toBeUndefined();
});

test("extracts the first forwarded ip and falls back to x-real-ip", () => {
	const forwardedReq = { headers: { "x-forwarded-for": "203.0.113.10, 10.0.0.1" } };
	const realIpReq = { headers: { "x-real-ip": "203.0.113.11" } };

	expect(getClientIp(forwardedReq)).toBe("203.0.113.10");
	expect(getClientIp(realIpReq)).toBe("203.0.113.11");
});

test("resets rate limits after the window elapses", () => {
	jest.useFakeTimers();
	jest.setSystemTime(new Date("2024-01-01T00:00:00.000Z"));
	try {
		const first = checkRateLimit("login:test");
		for (let i = 0; i < 9; i += 1) {
			checkRateLimit("login:test");
		}
		expect(checkRateLimit("login:test").ok).toBe(false);

		jest.setSystemTime(new Date(first.resetAt + 1));
		expect(checkRateLimit("login:test").ok).toBe(true);
	} finally {
		jest.useRealTimers();
	}
});

test("tracks email and ip combinations independently", () => {
	const email = "combo@example.com";
	const req = { headers: { "x-real-ip": "203.0.113.12" } };

	isLoginRateLimited(email, req);

	const keys = Array.from((globalThis as { loginRateLimit?: Map<string, unknown> }).loginRateLimit?.keys() ?? []);

	expect(keys).toEqual(
		expect.arrayContaining([`login:email:${email}`, "login:ip:203.0.113.12", `login:ip:203.0.113.12:email:${email}`]),
	);
});
