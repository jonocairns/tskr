import { checkRateLimit, getClientIp, getHeaderValue, isLoginRateLimited } from "../src/lib/loginRateLimit";

const clearRateLimit = () => {
	(globalThis as { loginRateLimit?: Map<string, unknown> }).loginRateLimit?.clear();
};

beforeEach(() => {
	clearRateLimit();
});

describe("basic rate limiting", () => {
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
});

describe("getHeaderValue", () => {
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

	test("handles undefined req", () => {
		expect(getHeaderValue(undefined, "x-real-ip")).toBeUndefined();
	});

	test("handles null req", () => {
		expect(getHeaderValue(null, "x-real-ip")).toBeUndefined();
	});

	test("handles non-object req", () => {
		expect(getHeaderValue("not an object", "x-real-ip")).toBeUndefined();
		expect(getHeaderValue(123, "x-real-ip")).toBeUndefined();
		expect(getHeaderValue(true, "x-real-ip")).toBeUndefined();
	});

	test("handles empty headers object", () => {
		const req = { headers: {} };
		expect(getHeaderValue(req, "x-real-ip")).toBeUndefined();
	});

	test("handles undefined header value", () => {
		const req = { headers: { "x-real-ip": undefined } };
		expect(getHeaderValue(req, "x-real-ip")).toBeUndefined();
	});

	test("handles empty string header value", () => {
		const req = { headers: { "x-real-ip": "" } };
		expect(getHeaderValue(req, "x-real-ip")).toBe("");
	});

	test("handles whitespace-only header value", () => {
		const req = { headers: { "x-real-ip": "   " } };
		expect(getHeaderValue(req, "x-real-ip")).toBe("   ");
	});

	test("handles empty array header value", () => {
		const req = { headers: { "x-forwarded-for": [] } };
		expect(getHeaderValue(req, "x-forwarded-for")).toBe("");
	});

	test("handles array with empty strings", () => {
		const req = { headers: { "x-forwarded-for": ["", "", ""] } };
		expect(getHeaderValue(req, "x-forwarded-for")).toBe(",,");
	});

	test("handles array with mixed values", () => {
		const req = { headers: { "x-forwarded-for": ["198.51.100.1", "", "198.51.100.2"] } };
		expect(getHeaderValue(req, "x-forwarded-for")).toBe("198.51.100.1,,198.51.100.2");
	});

	test("handles numeric header value", () => {
		const req = { headers: { "x-custom": 12345 } };
		expect(getHeaderValue(req, "x-custom")).toBeUndefined();
	});

	test("handles boolean header value", () => {
		const req = { headers: { "x-custom": true } };
		expect(getHeaderValue(req, "x-custom")).toBeUndefined();
	});

	test("handles object header value", () => {
		const req = { headers: { "x-custom": { nested: "value" } } };
		expect(getHeaderValue(req, "x-custom")).toBeUndefined();
	});

	test("prefers exact case match over lowercase", () => {
		const req = { headers: { "X-Real-IP": "203.0.113.1", "x-real-ip": "203.0.113.2" } };
		expect(getHeaderValue(req, "X-Real-IP")).toBe("203.0.113.1");
	});

	test("handles Headers object with null return", () => {
		const headers = { get: () => null };
		const req = { headers };
		expect(getHeaderValue(req, "x-real-ip")).toBeUndefined();
	});

	test("handles Headers object with undefined return", () => {
		const headers = { get: () => undefined };
		const req = { headers };
		expect(getHeaderValue(req, "x-real-ip")).toBeUndefined();
	});
});

describe("getClientIp", () => {
	test("extracts the first forwarded ip and falls back to x-real-ip", () => {
		const forwardedReq = { headers: { "x-forwarded-for": "203.0.113.10, 10.0.0.1" } };
		const realIpReq = { headers: { "x-real-ip": "203.0.113.11" } };

		expect(getClientIp(forwardedReq)).toBe("203.0.113.10");
		expect(getClientIp(realIpReq)).toBe("203.0.113.11");
	});

	test("handles single ip in x-forwarded-for", () => {
		const req = { headers: { "x-forwarded-for": "203.0.113.10" } };
		expect(getClientIp(req)).toBe("203.0.113.10");
	});

	test("handles multiple ips in x-forwarded-for", () => {
		const req = { headers: { "x-forwarded-for": "203.0.113.10, 10.0.0.1, 10.0.0.2, 10.0.0.3" } };
		expect(getClientIp(req)).toBe("203.0.113.10");
	});

	test("trims whitespace from forwarded ip", () => {
		const req = { headers: { "x-forwarded-for": "  203.0.113.10  , 10.0.0.1" } };
		expect(getClientIp(req)).toBe("203.0.113.10");
	});

	test("handles x-forwarded-for with only spaces", () => {
		const req = { headers: { "x-forwarded-for": "   " } };
		expect(getClientIp(req)).toBeUndefined();
	});

	test("handles x-forwarded-for with empty string", () => {
		const req = { headers: { "x-forwarded-for": "" } };
		expect(getClientIp(req)).toBeUndefined();
	});

	test("handles x-forwarded-for with comma only", () => {
		const req = { headers: { "x-forwarded-for": "," } };
		expect(getClientIp(req)).toBeUndefined();
	});

	test("handles x-forwarded-for with multiple commas", () => {
		const req = { headers: { "x-forwarded-for": ",,," } };
		expect(getClientIp(req)).toBeUndefined();
	});

	test("handles x-forwarded-for starting with comma", () => {
		const req = { headers: { "x-forwarded-for": ", 203.0.113.10" } };
		expect(getClientIp(req)).toBeUndefined();
	});

	test("prefers x-forwarded-for over x-real-ip", () => {
		const req = { headers: { "x-forwarded-for": "203.0.113.10", "x-real-ip": "203.0.113.11" } };
		expect(getClientIp(req)).toBe("203.0.113.10");
	});

	test("falls back to x-real-ip when x-forwarded-for is empty", () => {
		const req = { headers: { "x-forwarded-for": "", "x-real-ip": "203.0.113.11" } };
		expect(getClientIp(req)).toBe("203.0.113.11");
	});

	test("returns undefined when x-forwarded-for is whitespace", () => {
		const req = { headers: { "x-forwarded-for": "   ", "x-real-ip": "203.0.113.11" } };
		expect(getClientIp(req)).toBeUndefined();
	});

	test("returns undefined when no ip headers present", () => {
		const req = { headers: {} };
		expect(getClientIp(req)).toBeUndefined();
	});

	test("returns undefined when req is undefined", () => {
		expect(getClientIp(undefined)).toBeUndefined();
	});

	test("returns undefined when req is null", () => {
		expect(getClientIp(null)).toBeUndefined();
	});

	test("handles IPv6 addresses", () => {
		const req = { headers: { "x-forwarded-for": "2001:0db8:85a3::8a2e:0370:7334, 10.0.0.1" } };
		expect(getClientIp(req)).toBe("2001:0db8:85a3::8a2e:0370:7334");
	});

	test("handles mixed IPv4 and IPv6", () => {
		const req = { headers: { "x-forwarded-for": "203.0.113.10, 2001:0db8::1" } };
		expect(getClientIp(req)).toBe("203.0.113.10");
	});
});

describe("checkRateLimit", () => {
	test("returns ok true for first attempt", () => {
		const result = checkRateLimit("test:key");
		expect(result.ok).toBe(true);
		expect(result.resetAt).toBeGreaterThan(Date.now());
	});

	test("increments count on subsequent attempts", () => {
		checkRateLimit("test:key");
		checkRateLimit("test:key");
		const result = checkRateLimit("test:key");
		expect(result.ok).toBe(true);
	});

	test("blocks at exactly the limit", () => {
		for (let i = 0; i < 10; i += 1) {
			expect(checkRateLimit("test:key").ok).toBe(true);
		}
		expect(checkRateLimit("test:key").ok).toBe(false);
	});

	test("remains blocked after reaching limit", () => {
		for (let i = 0; i < 10; i += 1) {
			checkRateLimit("test:key");
		}
		expect(checkRateLimit("test:key").ok).toBe(false);
		expect(checkRateLimit("test:key").ok).toBe(false);
		expect(checkRateLimit("test:key").ok).toBe(false);
	});

	test("resets after window expires", () => {
		jest.useFakeTimers();
		const startTime = Date.now();
		jest.setSystemTime(startTime);

		try {
			const first = checkRateLimit("test:key");
			for (let i = 0; i < 9; i += 1) {
				checkRateLimit("test:key");
			}
			expect(checkRateLimit("test:key").ok).toBe(false);

			jest.setSystemTime(first.resetAt + 1);
			expect(checkRateLimit("test:key").ok).toBe(true);
		} finally {
			jest.useRealTimers();
		}
	});

	test("maintains separate counters for different keys", () => {
		for (let i = 0; i < 10; i += 1) {
			checkRateLimit("key1");
		}
		expect(checkRateLimit("key1").ok).toBe(false);
		expect(checkRateLimit("key2").ok).toBe(true);
	});

	test("handles empty string key", () => {
		const result = checkRateLimit("");
		expect(result.ok).toBe(true);
	});

	test("handles very long key", () => {
		const longKey = "x".repeat(1000);
		const result = checkRateLimit(longKey);
		expect(result.ok).toBe(true);
	});

	test("handles keys with special characters", () => {
		const result = checkRateLimit("login:email:test@example.com:ip:203.0.113.10");
		expect(result.ok).toBe(true);
	});

	test("preserves resetAt across attempts within window", () => {
		const first = checkRateLimit("test:key");
		const second = checkRateLimit("test:key");
		expect(second.resetAt).toBe(first.resetAt);
	});

	test("updates resetAt after window expires", () => {
		jest.useFakeTimers();
		try {
			const first = checkRateLimit("test:key");
			jest.setSystemTime(first.resetAt + 1000);
			const second = checkRateLimit("test:key");
			expect(second.resetAt).toBeGreaterThan(first.resetAt);
		} finally {
			jest.useRealTimers();
		}
	});
});

describe("isLoginRateLimited", () => {
	test("blocks on email limit only", () => {
		for (let i = 0; i < 10; i += 1) {
			isLoginRateLimited("user@example.com", undefined);
		}
		expect(isLoginRateLimited("user@example.com", undefined)).toBe(true);
	});

	test("blocks on ip limit only", () => {
		const req = { headers: { "x-real-ip": "203.0.113.10" } };
		for (let i = 0; i < 10; i += 1) {
			isLoginRateLimited(`user${i}@example.com`, req);
		}
		expect(isLoginRateLimited("new@example.com", req)).toBe(true);
	});

	test("blocks on combined email+ip limit", () => {
		const req = { headers: { "x-real-ip": "203.0.113.10" } };
		for (let i = 0; i < 10; i += 1) {
			isLoginRateLimited("user@example.com", req);
		}
		expect(isLoginRateLimited("user@example.com", req)).toBe(true);
	});

	test("allows different emails from different ips", () => {
		for (let i = 0; i < 5; i += 1) {
			const req = { headers: { "x-real-ip": `203.0.113.${i}` } };
			isLoginRateLimited(`user${i}@example.com`, req);
		}

		const newReq = { headers: { "x-real-ip": "203.0.113.100" } };
		expect(isLoginRateLimited("new@example.com", newReq)).toBe(false);
	});

	test("handles missing ip gracefully", () => {
		for (let i = 0; i < 10; i += 1) {
			isLoginRateLimited("user@example.com", {});
		}
		expect(isLoginRateLimited("user@example.com", {})).toBe(true);
	});

	test("handles malformed request object", () => {
		expect(isLoginRateLimited("user@example.com", "not an object")).toBe(false);
		expect(isLoginRateLimited("user@example.com", 123)).toBe(false);
		expect(isLoginRateLimited("user@example.com", null)).toBe(false);
	});

	test("tracks three rate limit keys when ip present", () => {
		const req = { headers: { "x-real-ip": "203.0.113.10" } };
		isLoginRateLimited("user@example.com", req);

		const keys = Array.from((globalThis as { loginRateLimit?: Map<string, unknown> }).loginRateLimit?.keys() ?? []);
		expect(keys).toHaveLength(3);
		expect(keys).toContain("login:email:user@example.com");
		expect(keys).toContain("login:ip:203.0.113.10");
		expect(keys).toContain("login:ip:203.0.113.10:email:user@example.com");
	});

	test("tracks one rate limit key when ip missing", () => {
		isLoginRateLimited("user@example.com", undefined);

		const keys = Array.from((globalThis as { loginRateLimit?: Map<string, unknown> }).loginRateLimit?.keys() ?? []);
		expect(keys).toHaveLength(1);
		expect(keys).toContain("login:email:user@example.com");
	});

	test("handles empty email", () => {
		const result = isLoginRateLimited("", undefined);
		expect(result).toBe(false);
	});

	test("handles email with special characters", () => {
		const email = "test+tag@example.co.uk";
		for (let i = 0; i < 10; i += 1) {
			isLoginRateLimited(email, undefined);
		}
		expect(isLoginRateLimited(email, undefined)).toBe(true);
	});
});

describe("concurrent requests", () => {
	test("handles concurrent rate limit checks", () => {
		const results: boolean[] = [];
		for (let i = 0; i < 15; i += 1) {
			results.push(!checkRateLimit("concurrent:key").ok);
		}

		const blockedCount = results.filter(Boolean).length;
		expect(blockedCount).toBe(5);
	});

	test("handles concurrent login attempts from same email", () => {
		const results: boolean[] = [];
		for (let i = 0; i < 15; i += 1) {
			results.push(isLoginRateLimited("user@example.com", undefined));
		}

		const blockedCount = results.filter(Boolean).length;
		expect(blockedCount).toBe(5);
	});

	test("handles concurrent login attempts from same ip", () => {
		const req = { headers: { "x-real-ip": "203.0.113.10" } };
		const results: boolean[] = [];
		for (let i = 0; i < 15; i += 1) {
			results.push(isLoginRateLimited(`user${i}@example.com`, req));
		}

		const blockedCount = results.filter(Boolean).length;
		expect(blockedCount).toBe(5);
	});
});
