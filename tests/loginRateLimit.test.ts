import { isLoginRateLimited } from "../src/lib/loginRateLimit";

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

test("blocks after too many attempts from the same ip", () => {
	const req = { headers: { "x-forwarded-for": "203.0.113.10, 10.0.0.1" } };
	for (let i = 0; i < 10; i += 1) {
		expect(isLoginRateLimited(`user${i}@example.com`, req)).toBe(false);
	}
	expect(isLoginRateLimited("another@example.com", req)).toBe(true);
});
