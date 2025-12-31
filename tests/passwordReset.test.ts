import { hashPasswordResetToken } from "../src/lib/passwordReset";

describe("hashPasswordResetToken", () => {
	test("produces consistent SHA-256 hash for same token", () => {
		const token = "test-token-123";
		const hash1 = hashPasswordResetToken(token);
		const hash2 = hashPasswordResetToken(token);

		expect(hash1).toBe(hash2);
		expect(hash1).toHaveLength(64); // SHA-256 produces 64 hex characters
	});

	test("produces different hashes for different tokens", () => {
		const token1 = "token1";
		const token2 = "token2";

		const hash1 = hashPasswordResetToken(token1);
		const hash2 = hashPasswordResetToken(token2);

		expect(hash1).not.toBe(hash2);
	});

	test("produces valid hex string", () => {
		const token = "my-reset-token";
		const hash = hashPasswordResetToken(token);

		expect(hash).toMatch(/^[a-f0-9]{64}$/);
	});

	test("handles empty string token", () => {
		const hash = hashPasswordResetToken("");
		expect(hash).toHaveLength(64);
		expect(hash).toMatch(/^[a-f0-9]{64}$/);
	});

	test("handles very long tokens", () => {
		const longToken = "a".repeat(10000);
		const hash = hashPasswordResetToken(longToken);

		expect(hash).toHaveLength(64);
		expect(hash).toMatch(/^[a-f0-9]{64}$/);
	});

	test("handles tokens with special characters", () => {
		const specialToken = "token!@#$%^&*()[]{}|;:',.<>?/~`±§";
		const hash = hashPasswordResetToken(specialToken);

		expect(hash).toHaveLength(64);
		expect(hash).toMatch(/^[a-f0-9]{64}$/);
	});

	test("handles unicode tokens", () => {
		const unicodeToken = "トークン🔒中文🚀";
		const hash = hashPasswordResetToken(unicodeToken);

		expect(hash).toHaveLength(64);
		expect(hash).toMatch(/^[a-f0-9]{64}$/);
	});

	test("handles base64url encoded tokens", () => {
		const token = Buffer.from("random bytes here").toString("base64url");
		const hash = hashPasswordResetToken(token);

		expect(hash).toHaveLength(64);
		expect(hash).toMatch(/^[a-f0-9]{64}$/);
	});

	test("is case sensitive", () => {
		const hash1 = hashPasswordResetToken("Token");
		const hash2 = hashPasswordResetToken("token");

		expect(hash1).not.toBe(hash2);
	});

	test("single character difference produces different hash", () => {
		const hash1 = hashPasswordResetToken("token123");
		const hash2 = hashPasswordResetToken("token124");

		expect(hash1).not.toBe(hash2);
	});

	test("produces cryptographically strong hash distribution", () => {
		const tokens = Array.from({ length: 100 }, (_, i) => `token-${i}`);
		const hashes = tokens.map((token) => hashPasswordResetToken(token));

		const uniqueHashes = new Set(hashes);
		expect(uniqueHashes.size).toBe(100);

		const firstChars = new Set(hashes.map((h) => h[0]));
		expect(firstChars.size).toBeGreaterThan(5);
	});

	test("produces SHA-256 specific hash", () => {
		const token = "test";
		const hash = hashPasswordResetToken(token);

		const expectedHash = "9f86d081884c7d659a2feaa0c55ad015a3bf4f1b2b0b822cd15d6c15b0f00a08";
		expect(hash).toBe(expectedHash);
	});

	test("handles whitespace correctly", () => {
		const hash1 = hashPasswordResetToken("token");
		const hash2 = hashPasswordResetToken("token ");
		const hash3 = hashPasswordResetToken(" token");
		const hash4 = hashPasswordResetToken("to ken");

		expect(hash1).not.toBe(hash2);
		expect(hash1).not.toBe(hash3);
		expect(hash1).not.toBe(hash4);
		expect(hash2).not.toBe(hash3);
	});

	test("handles null bytes in token", () => {
		const tokenWithNull = "token\x00value";
		const hash = hashPasswordResetToken(tokenWithNull);

		expect(hash).toHaveLength(64);
		expect(hash).toMatch(/^[a-f0-9]{64}$/);
	});

	test("handles newlines and tabs", () => {
		const tokenWithWhitespace = "token\n\t\rvalue";
		const hash = hashPasswordResetToken(tokenWithWhitespace);

		expect(hash).toHaveLength(64);
		expect(hash).toMatch(/^[a-f0-9]{64}$/);
	});

	test("deterministic hashing for same input", () => {
		const token = "consistent-token-value";
		const hashes = Array.from({ length: 10 }, () => hashPasswordResetToken(token));

		const uniqueHashes = new Set(hashes);
		expect(uniqueHashes.size).toBe(1);
	});

	test("handles extremely long tokens efficiently", () => {
		const veryLongToken = "x".repeat(1000000); // 1MB token
		const startTime = Date.now();
		const hash = hashPasswordResetToken(veryLongToken);
		const duration = Date.now() - startTime;

		expect(hash).toHaveLength(64);
		expect(hash).toMatch(/^[a-f0-9]{64}$/);
		expect(duration).toBeLessThan(1000);
	});

	test("handles emoji and surrogate pairs", () => {
		const emojiToken = "🔐🔑🗝️🔓🔒";
		const hash = hashPasswordResetToken(emojiToken);

		expect(hash).toHaveLength(64);
		expect(hash).toMatch(/^[a-f0-9]{64}$/);
	});

	test("different string encodings produce expected hashes", () => {
		// These should all produce different hashes despite visual similarity
		const token1 = "café"; // é as single character
		const token2 = "café"; // e + combining accent
		const hash1 = hashPasswordResetToken(token1);
		const hash2 = hashPasswordResetToken(token2);

		// May or may not be equal depending on normalization,
		// but hashing should be consistent
		expect(hash1).toHaveLength(64);
		expect(hash2).toHaveLength(64);
	});

	test("hash collision resistance", () => {
		const tokens = Array.from({ length: 1000 }, (_, i) => `token-${i}-${Math.random()}`);
		const hashes = tokens.map((t) => hashPasswordResetToken(t));

		const uniqueHashes = new Set(hashes);
		expect(uniqueHashes.size).toBe(1000);
	});

	test("avalanche effect - small input change causes large hash change", () => {
		const token1 = "password123";
		const token2 = "password124"; // Changed last character

		const hash1 = hashPasswordResetToken(token1);
		const hash2 = hashPasswordResetToken(token2);

		let differences = 0;
		for (let i = 0; i < 64; i++) {
			if (hash1[i] !== hash2[i]) {
				differences++;
			}
		}

		expect(differences).toBeGreaterThan(25);
		expect(differences).toBeLessThan(64);
	});

	test("handles base64url tokens from real token generation", () => {
		const realTokenExamples = [
			"ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmn",
			"0123456789_-ABCDEFGHIJKLMNOPQRSTUVWXYZ",
			"base64url_safe-characters_without_padding",
		];

		for (const token of realTokenExamples) {
			const hash = hashPasswordResetToken(token);
			expect(hash).toHaveLength(64);
			expect(hash).toMatch(/^[a-f0-9]{64}$/);
		}
	});

	test("security: hash reveals no information about token length", () => {
		const shortToken = "a";
		const longToken = "a".repeat(1000);

		const hash1 = hashPasswordResetToken(shortToken);
		const hash2 = hashPasswordResetToken(longToken);

		expect(hash1).toHaveLength(64);
		expect(hash2).toHaveLength(64);
		expect(hash1).not.toBe(hash2);
	});

	test("security: similar tokens produce completely different hashes", () => {
		const tokens = ["token", "token1", "token2", "token3", "token4"];
		const hashes = tokens.map((t) => hashPasswordResetToken(t));

		for (let i = 0; i < hashes.length; i++) {
			for (let j = i + 1; j < hashes.length; j++) {
				expect(hashes[i]).not.toContain(hashes[j]?.substring(0, 10));
				expect(hashes[j]).not.toContain(hashes[i]?.substring(0, 10));
			}
		}
	});

	test("security: hash output has good entropy", () => {
		const token = "test-token-for-entropy";
		const hash = hashPasswordResetToken(token);

		const charCounts: Record<string, number> = {};
		for (const char of hash) {
			charCounts[char] = (charCounts[char] || 0) + 1;
		}

		const counts = Object.values(charCounts);
		const maxCount = Math.max(...counts);
		expect(maxCount).toBeLessThanOrEqual(12);
	});

	test("handles sequential tokens with similar patterns", () => {
		const tokens = [
			"reset-token-2024-01-01-00:00:00",
			"reset-token-2024-01-01-00:00:01",
			"reset-token-2024-01-01-00:00:02",
		];

		const hashes = tokens.map((t) => hashPasswordResetToken(t));

		const uniqueHashes = new Set(hashes);
		expect(uniqueHashes.size).toBe(3);

		for (let i = 0; i < hashes.length; i++) {
			for (let j = i + 1; j < hashes.length; j++) {
				let matches = 0;
				for (let k = 0; k < 64; k++) {
					if (hashes[i]?.[k] === hashes[j]?.[k]) {
						matches++;
					}
				}
				expect(matches).toBeLessThan(10);
			}
		}
	});

	test("real-world token validation scenario", () => {
		const generatedToken = `reset-${Date.now()}-${Math.random()}`;

		const storedHash = hashPasswordResetToken(generatedToken);

		const providedToken = generatedToken;
		const providedHash = hashPasswordResetToken(providedToken);

		expect(providedHash).toBe(storedHash);

		const wrongToken = `${generatedToken}x`;
		const wrongHash = hashPasswordResetToken(wrongToken);
		expect(wrongHash).not.toBe(storedHash);
	});

	test("performance: can hash many tokens quickly", () => {
		const startTime = Date.now();
		const count = 1000;

		for (let i = 0; i < count; i++) {
			hashPasswordResetToken(`token-${i}`);
		}

		const duration = Date.now() - startTime;
		const perToken = duration / count;

		expect(perToken).toBeLessThan(10);
	});
});
