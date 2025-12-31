import { baseConfig as config } from "../config";
import { type SessionTimestamps, validateSessionExpiry } from "../src/lib/sessionValidation";

const now = () => Math.floor(Date.now() / 1000);
const secondsAgo = (seconds: number) => now() - seconds;
const secondsFromNow = (seconds: number) => now() + seconds;

const MAX_AGE = config.sessionMaxAge;
const IDLE_TIMEOUT = config.sessionIdleTimeout;

describe("validateSessionExpiry", () => {
	describe("valid sessions", () => {
		test("returns valid for fresh session with recent activity", () => {
			const timestamps: SessionTimestamps = {
				iat: secondsAgo(60),
				lastActivity: secondsAgo(30),
			};

			const result = validateSessionExpiry(timestamps);
			expect(result).toEqual({ valid: true });
		});

		test("returns valid for session just created", () => {
			const timestamps: SessionTimestamps = {
				iat: now(),
				lastActivity: now(),
			};

			const result = validateSessionExpiry(timestamps);
			expect(result).toEqual({ valid: true });
		});

		test("returns valid for session without lastActivity", () => {
			const timestamps: SessionTimestamps = {
				iat: secondsAgo(3600),
			};

			const result = validateSessionExpiry(timestamps);
			expect(result).toEqual({ valid: true });
		});

		test("returns valid for session near maxAge boundary", () => {
			const timestamps: SessionTimestamps = {
				iat: secondsAgo(MAX_AGE - 60),
				lastActivity: secondsAgo(30),
			};

			const result = validateSessionExpiry(timestamps);
			expect(result).toEqual({ valid: true });
		});

		test("returns valid for session near idle timeout boundary", () => {
			const timestamps: SessionTimestamps = {
				iat: secondsAgo(3600),
				lastActivity: secondsAgo(IDLE_TIMEOUT - 60),
			};

			const result = validateSessionExpiry(timestamps);
			expect(result).toEqual({ valid: true });
		});

		test("returns valid for old session with recent activity", () => {
			const timestamps: SessionTimestamps = {
				iat: secondsAgo(MAX_AGE - 3600),
				lastActivity: secondsAgo(60),
			};

			const result = validateSessionExpiry(timestamps);
			expect(result).toEqual({ valid: true });
		});
	});

	describe("expired sessions (maxAge)", () => {
		test("returns valid for session exactly at maxAge", () => {
			const timestamps: SessionTimestamps = {
				iat: secondsAgo(MAX_AGE),
				lastActivity: now(),
			};

			const result = validateSessionExpiry(timestamps);
			expect(result).toEqual({ valid: true });
		});

		test("returns expired for session beyond maxAge", () => {
			const timestamps: SessionTimestamps = {
				iat: secondsAgo(MAX_AGE + 1),
				lastActivity: now(),
			};

			const result = validateSessionExpiry(timestamps);
			expect(result).toEqual({ valid: false, reason: "expired" });
		});

		test("returns expired for very old session", () => {
			const timestamps: SessionTimestamps = {
				iat: secondsAgo(MAX_AGE * 2),
				lastActivity: now(),
			};

			const result = validateSessionExpiry(timestamps);
			expect(result).toEqual({ valid: false, reason: "expired" });
		});

		test("returns expired for session with missing iat", () => {
			const timestamps: SessionTimestamps = {
				lastActivity: now(),
			};

			const result = validateSessionExpiry(timestamps);
			expect(result).toEqual({ valid: false, reason: "expired" });
		});

		test("returns expired for session with undefined iat", () => {
			const timestamps: SessionTimestamps = {
				iat: undefined,
				lastActivity: now(),
			};

			const result = validateSessionExpiry(timestamps);
			expect(result).toEqual({ valid: false, reason: "expired" });
		});

		test("returns expired for session with zero iat", () => {
			const timestamps: SessionTimestamps = {
				iat: 0,
				lastActivity: now(),
			};

			const result = validateSessionExpiry(timestamps);
			expect(result).toEqual({ valid: false, reason: "expired" });
		});
	});

	describe("idle timeout", () => {
		test("returns valid for session with no activity for exactly idleTimeout", () => {
			const timestamps: SessionTimestamps = {
				iat: secondsAgo(3600),
				lastActivity: secondsAgo(IDLE_TIMEOUT),
			};

			const result = validateSessionExpiry(timestamps);
			expect(result).toEqual({ valid: true });
		});

		test("returns idle_timeout for session beyond idle timeout", () => {
			const timestamps: SessionTimestamps = {
				iat: secondsAgo(3600),
				lastActivity: secondsAgo(IDLE_TIMEOUT + 1),
			};

			const result = validateSessionExpiry(timestamps);
			expect(result).toEqual({ valid: false, reason: "idle_timeout" });
		});

		test("returns idle_timeout for session idle for 48 hours", () => {
			const timestamps: SessionTimestamps = {
				iat: secondsAgo(7200),
				lastActivity: secondsAgo(IDLE_TIMEOUT * 2),
			};

			const result = validateSessionExpiry(timestamps);
			expect(result).toEqual({ valid: false, reason: "idle_timeout" });
		});

		test("idle timeout takes precedence over valid maxAge", () => {
			const timestamps: SessionTimestamps = {
				iat: secondsAgo(3600),
				lastActivity: secondsAgo(IDLE_TIMEOUT + 60),
			};

			const result = validateSessionExpiry(timestamps);
			expect(result).toEqual({ valid: false, reason: "idle_timeout" });
		});
	});

	describe("edge cases and boundary conditions", () => {
		test("handles future iat gracefully", () => {
			const timestamps: SessionTimestamps = {
				iat: secondsFromNow(3600),
				lastActivity: now(),
			};

			const result = validateSessionExpiry(timestamps);
			expect(result).toEqual({ valid: true });
		});

		test("handles future lastActivity gracefully", () => {
			const timestamps: SessionTimestamps = {
				iat: secondsAgo(3600),
				lastActivity: secondsFromNow(3600),
			};

			const result = validateSessionExpiry(timestamps);
			expect(result).toEqual({ valid: true });
		});

		test("handles very large iat value", () => {
			const timestamps: SessionTimestamps = {
				iat: Number.MAX_SAFE_INTEGER,
				lastActivity: now(),
			};

			const result = validateSessionExpiry(timestamps);
			expect(result).toEqual({ valid: true });
		});

		test("handles negative iat value", () => {
			const timestamps: SessionTimestamps = {
				iat: -1000,
				lastActivity: now(),
			};

			const result = validateSessionExpiry(timestamps);
			expect(result).toEqual({ valid: false, reason: "expired" });
		});

		test("handles negative lastActivity value", () => {
			const timestamps: SessionTimestamps = {
				iat: secondsAgo(3600),
				lastActivity: -1000,
			};

			const result = validateSessionExpiry(timestamps);
			expect(result).toEqual({ valid: false, reason: "idle_timeout" });
		});

		test("handles empty object", () => {
			const timestamps: SessionTimestamps = {};

			const result = validateSessionExpiry(timestamps);
			expect(result).toEqual({ valid: false, reason: "expired" });
		});

		test("handles both timestamps at exact boundaries", () => {
			const timestamps: SessionTimestamps = {
				iat: secondsAgo(MAX_AGE),
				lastActivity: secondsAgo(IDLE_TIMEOUT),
			};

			const result = validateSessionExpiry(timestamps);
			expect(result).toEqual({ valid: true });
		});

		test("handles iat at boundary, lastActivity beyond boundary", () => {
			const timestamps: SessionTimestamps = {
				iat: secondsAgo(MAX_AGE),
				lastActivity: secondsAgo(IDLE_TIMEOUT + 1),
			};

			const result = validateSessionExpiry(timestamps);
			expect(result).toEqual({ valid: false, reason: "idle_timeout" });
		});
	});

	describe("real-world scenarios", () => {
		test("scenario: active user session", () => {
			const timestamps: SessionTimestamps = {
				iat: secondsAgo(5 * 24 * 3600),
				lastActivity: secondsAgo(600),
			};

			const result = validateSessionExpiry(timestamps);
			expect(result).toEqual({ valid: true });
		});

		test("scenario: user on vacation returns after 25 days", () => {
			const timestamps: SessionTimestamps = {
				iat: secondsAgo(25 * 24 * 3600),
				lastActivity: secondsAgo(25 * 24 * 3600),
			};

			const result = validateSessionExpiry(timestamps);
			expect(result).toEqual({ valid: false, reason: "idle_timeout" });
		});

		test("scenario: long-time user session expires", () => {
			const timestamps: SessionTimestamps = {
				iat: secondsAgo(31 * 24 * 3600),
				lastActivity: secondsAgo(24 * 3600),
			};

			const result = validateSessionExpiry(timestamps);
			expect(result).toEqual({ valid: false, reason: "expired" });
		});

		test("scenario: user leaves tab open overnight", () => {
			const timestamps: SessionTimestamps = {
				iat: secondsAgo(26 * 3600),
				lastActivity: secondsAgo(25 * 3600),
			};

			const result = validateSessionExpiry(timestamps);
			expect(result).toEqual({ valid: false, reason: "idle_timeout" });
		});

		test("scenario: active user during work hours", () => {
			const timestamps: SessionTimestamps = {
				iat: secondsAgo(8 * 3600),
				lastActivity: secondsAgo(300),
			};

			const result = validateSessionExpiry(timestamps);
			expect(result).toEqual({ valid: true });
		});

		test("scenario: session at exactly 30 days needs re-login", () => {
			const timestamps: SessionTimestamps = {
				iat: secondsAgo(MAX_AGE + 1),
				lastActivity: secondsAgo(60),
			};

			const result = validateSessionExpiry(timestamps);
			expect(result).toEqual({ valid: false, reason: "expired" });
		});

		test("scenario: legacy session without lastActivity tracking", () => {
			const timestamps: SessionTimestamps = {
				iat: secondsAgo(5 * 24 * 3600),
			};

			const result = validateSessionExpiry(timestamps);
			expect(result).toEqual({ valid: true });
		});

		test("scenario: corrupted session missing iat", () => {
			const timestamps: SessionTimestamps = {
				lastActivity: secondsAgo(60),
			};

			const result = validateSessionExpiry(timestamps);
			expect(result).toEqual({ valid: false, reason: "expired" });
		});
	});

	describe("timing precision", () => {
		test("validates at exact second boundaries", () => {
			const exactIat = Math.floor(Date.now() / 1000) - MAX_AGE;
			const timestamps: SessionTimestamps = {
				iat: exactIat,
				lastActivity: now(),
			};

			const result = validateSessionExpiry(timestamps);
			expect(result).toEqual({ valid: true });
		});

		test("one second before expiry is valid", () => {
			const timestamps: SessionTimestamps = {
				iat: secondsAgo(MAX_AGE - 1),
				lastActivity: now(),
			};

			const result = validateSessionExpiry(timestamps);
			expect(result).toEqual({ valid: true });
		});

		test("one second before idle timeout is valid", () => {
			const timestamps: SessionTimestamps = {
				iat: secondsAgo(3600),
				lastActivity: secondsAgo(IDLE_TIMEOUT - 1),
			};

			const result = validateSessionExpiry(timestamps);
			expect(result).toEqual({ valid: true });
		});
	});

	describe("defense-in-depth scenarios", () => {
		test("prevents session hijacking from inactive session", () => {
			const timestamps: SessionTimestamps = {
				iat: secondsAgo(10 * 24 * 3600),
				lastActivity: secondsAgo(2 * 24 * 3600),
			};

			const result = validateSessionExpiry(timestamps);
			expect(result).toEqual({ valid: false, reason: "idle_timeout" });
		});

		test("forces re-authentication after max age", () => {
			const timestamps: SessionTimestamps = {
				iat: secondsAgo(30 * 24 * 3600 + 1),
				lastActivity: secondsAgo(1),
			};

			const result = validateSessionExpiry(timestamps);
			expect(result).toEqual({ valid: false, reason: "expired" });
		});

		test("handles clock adjustments during session", () => {
			const timestamps: SessionTimestamps = {
				iat: secondsAgo(100),
				lastActivity: secondsAgo(50),
			};

			const result = validateSessionExpiry(timestamps);
			expect(result).toEqual({ valid: true });
		});
	});

	describe("type safety and validation", () => {
		test("handles floating point timestamps", () => {
			const timestamps: SessionTimestamps = {
				iat: secondsAgo(3600) + 0.5,
				lastActivity: secondsAgo(60) + 0.9,
			};

			const result = validateSessionExpiry(timestamps);
			expect(result.valid).toBe(true);
		});

		test("handles very small positive iat", () => {
			const timestamps: SessionTimestamps = {
				iat: 1,
				lastActivity: now(),
			};

			const result = validateSessionExpiry(timestamps);
			expect(result).toEqual({ valid: false, reason: "expired" });
		});
	});

	describe("configuration validation", () => {
		test("config values are as expected", () => {
			expect(MAX_AGE).toBe(30 * 24 * 60 * 60);
			expect(IDLE_TIMEOUT).toBe(24 * 60 * 60);
		});

		test("maxAge is greater than idleTimeout", () => {
			expect(MAX_AGE).toBeGreaterThan(IDLE_TIMEOUT);
		});
	});
});
