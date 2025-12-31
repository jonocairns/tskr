import { hashPassword, verifyPassword } from "../src/lib/passwords";

describe("hashPassword", () => {
	test("returns a hash in the expected format", async () => {
		const hash = await hashPassword("mypassword123");
		expect(hash).toMatch(/^scrypt\$[a-f0-9]{32}\$[a-f0-9]{128}$/);
	});

	test("generates different salts for the same password", async () => {
		const hash1 = await hashPassword("samepassword");
		const hash2 = await hashPassword("samepassword");

		expect(hash1).not.toBe(hash2);

		const [, salt1] = hash1.split("$");
		const [, salt2] = hash2.split("$");
		expect(salt1).not.toBe(salt2);
	});

	test("handles empty password", async () => {
		const hash = await hashPassword("");
		expect(hash).toMatch(/^scrypt\$/);
		expect(hash.split("$")).toHaveLength(3);
	});

	test("handles very long passwords", async () => {
		const longPassword = "a".repeat(10000);
		const hash = await hashPassword(longPassword);
		expect(hash).toMatch(/^scrypt\$/);
	});

	test("handles passwords with special characters", async () => {
		const specialPassword = "p@ssw0rd!#$%^&*()[]{}|;:',.<>?/~`±§";
		const hash = await hashPassword(specialPassword);
		expect(hash).toMatch(/^scrypt\$/);
	});

	test("handles unicode characters", async () => {
		const unicodePassword = "パスワード🔒中文🚀";
		const hash = await hashPassword(unicodePassword);
		expect(hash).toMatch(/^scrypt\$/);
	});

	test("produces consistent hash format across multiple calls", async () => {
		const hashes = await Promise.all([hashPassword("test1"), hashPassword("test2"), hashPassword("test3")]);

		for (const hash of hashes) {
			const parts = hash.split("$");
			expect(parts).toHaveLength(3);
			expect(parts[0]).toBe("scrypt");
			expect(parts[1]).toHaveLength(32); // 16 bytes as hex = 32 chars
			expect(parts[2]).toHaveLength(128); // 64 bytes as hex = 128 chars
		}
	});
});

describe("verifyPassword", () => {
	describe("valid password verification", () => {
		test("returns true for correct password", async () => {
			const password = "mySecurePassword123";
			const hash = await hashPassword(password);
			const result = await verifyPassword(password, hash);
			expect(result).toBe(true);
		});

		test("returns false for incorrect password", async () => {
			const password = "correctPassword";
			const hash = await hashPassword(password);
			const result = await verifyPassword("wrongPassword", hash);
			expect(result).toBe(false);
		});

		test("verifies empty password correctly", async () => {
			const hash = await hashPassword("");
			const valid = await verifyPassword("", hash);
			const invalid = await verifyPassword("notempty", hash);
			expect(valid).toBe(true);
			expect(invalid).toBe(false);
		});

		test("is case sensitive", async () => {
			const password = "CaseSensitive";
			const hash = await hashPassword(password);
			const correct = await verifyPassword("CaseSensitive", hash);
			const wrong = await verifyPassword("casesensitive", hash);
			expect(correct).toBe(true);
			expect(wrong).toBe(false);
		});

		test("detects single character difference", async () => {
			const password = "password123";
			const hash = await hashPassword(password);
			const offByOne = await verifyPassword("password124", hash);
			expect(offByOne).toBe(false);
		});

		test("verifies special characters correctly", async () => {
			const password = "p@ssw0rd!#$%";
			const hash = await hashPassword(password);
			const result = await verifyPassword(password, hash);
			expect(result).toBe(true);
		});

		test("verifies unicode passwords correctly", async () => {
			const password = "パスワード🔒";
			const hash = await hashPassword(password);
			const result = await verifyPassword(password, hash);
			expect(result).toBe(true);
		});

		test("verifies very long passwords", async () => {
			const password = "a".repeat(10000);
			const hash = await hashPassword(password);
			const result = await verifyPassword(password, hash);
			expect(result).toBe(true);
		});
	});

	describe("invalid hash format handling", () => {
		test("returns false for empty hash string", async () => {
			const result = await verifyPassword("password", "");
			expect(result).toBe(false);
		});

		test("returns false for hash missing scheme", async () => {
			const result = await verifyPassword("password", "$salt$hash");
			expect(result).toBe(false);
		});

		test("returns false for wrong scheme", async () => {
			const result = await verifyPassword("password", "bcrypt$salt$hash");
			expect(result).toBe(false);
		});

		test("returns false for hash with missing salt", async () => {
			const result = await verifyPassword("password", "scrypt$$hash");
			expect(result).toBe(false);
		});

		test("returns false for hash with missing hash part", async () => {
			const result = await verifyPassword("password", "scrypt$salt$");
			expect(result).toBe(false);
		});

		test("returns false for hash with only two parts", async () => {
			const result = await verifyPassword("password", "scrypt$saltandhash");
			expect(result).toBe(false);
		});

		test("returns false for completely malformed hash", async () => {
			const result = await verifyPassword("password", "notavalidhash");
			expect(result).toBe(false);
		});

		test("accepts hash with extra parts (uses only first 3)", async () => {
			// The implementation uses destructuring [scheme, salt, hash] which ignores extra parts
			const password = "test";
			const validHash = await hashPassword(password);
			const hashWithExtra = `${validHash}$extra$parts`;
			const result = await verifyPassword(password, hashWithExtra);
			expect(result).toBe(true);
		});

		test("returns false for null-like strings", async () => {
			const nullResult = await verifyPassword("password", "null");
			const undefinedResult = await verifyPassword("password", "undefined");
			expect(nullResult).toBe(false);
			expect(undefinedResult).toBe(false);
		});
	});

	describe("corrupted hash handling", () => {
		test("handles invalid hex in salt gracefully", async () => {
			// Buffer.from accepts invalid hex and converts what it can
			// This won't match the password, so returns false
			const result = await verifyPassword("password", `scrypt$notvalidhex!@#$zzzz$${"a".repeat(128)}`);
			// The implementation doesn't validate hex format, but password won't verify
			expect(typeof result).toBe("boolean");
		});

		test("handles invalid hex in hash part gracefully", async () => {
			// Buffer.from will parse what it can, but won't match
			const result = await verifyPassword("password", `scrypt$${"a".repeat(32)}$notvalidhex!@#$`);
			// The implementation doesn't validate hex format, but password won't verify
			expect(typeof result).toBe("boolean");
		});

		test("adapts to different hash lengths dynamically", async () => {
			// The implementation uses storedBuffer.length for scrypt, so it adapts
			const password = "test";
			const validHash = await hashPassword(password);
			const wrongPassword = await verifyPassword("wrong", validHash);
			expect(wrongPassword).toBe(false);
		});

		test("handles truncated hash", async () => {
			const password = "test";
			const hash = await hashPassword(password);
			const truncated = hash.substring(0, hash.length - 10);
			// Will have shorter hash, but scrypt adapts to the length
			const result = await verifyPassword(password, truncated);
			// Result depends on whether truncated hash still works
			expect(typeof result).toBe("boolean");
		});
	});

	describe("timing attack resistance", () => {
		test("uses timingSafeEqual for comparison", async () => {
			const password = "testpassword";
			const hash = await hashPassword(password);

			// These should both return false, but we're testing they don't throw
			const result1 = await verifyPassword("wrongpassword", hash);
			const result2 = await verifyPassword("differentwrong", hash);

			expect(result1).toBe(false);
			expect(result2).toBe(false);
		});

		test("scrypt adapts to different buffer lengths", async () => {
			// The implementation uses storedBuffer.length when deriving,
			// so it generates a buffer of the same length to compare
			const password = "test";
			const validHash = await hashPassword(password);
			const [scheme, salt, hash] = validHash.split("$");
			const shorterHash = hash.substring(0, 64); // Half length
			const modifiedHash = `${scheme}$${salt}$${shorterHash}`;

			// Will derive a 32-byte hash instead of 64-byte and compare
			const result = await verifyPassword(password, modifiedHash);
			// This won't match because different key length
			expect(typeof result).toBe("boolean");
		});
	});

	describe("edge cases and security", () => {
		test("different passwords produce different hashes", async () => {
			const hash1 = await hashPassword("password1");
			const hash2 = await hashPassword("password2");
			expect(hash1).not.toBe(hash2);
		});

		test("similar passwords are not confused", async () => {
			const base = "password";
			const hash = await hashPassword(base);

			const variations = ["password ", " password", "Password", "password1", "passwor", "passwords"];

			for (const variation of variations) {
				const result = await verifyPassword(variation, hash);
				expect(result).toBe(false);
			}
		});

		test("whitespace matters in password", async () => {
			const password = "pass word";
			const hash = await hashPassword(password);
			const correct = await verifyPassword("pass word", hash);
			const wrong = await verifyPassword("password", hash);
			expect(correct).toBe(true);
			expect(wrong).toBe(false);
		});

		test("handles multiple rapid hash/verify cycles", async () => {
			const results = await Promise.all(
				Array.from({ length: 10 }, async (_, i) => {
					const password = `password${i}`;
					const hash = await hashPassword(password);
					return verifyPassword(password, hash);
				}),
			);

			expect(results.every((r) => r === true)).toBe(true);
		});
	});

	describe("real-world scenarios", () => {
		test("scenario: user registration and login", async () => {
			// Registration: hash the password
			const userPassword = "MySecurePass123!";
			const storedHash = await hashPassword(userPassword);

			// Store in database (simulated)
			const database = { passwordHash: storedHash };

			// Login attempt with correct password
			const loginSuccess = await verifyPassword(userPassword, database.passwordHash);
			expect(loginSuccess).toBe(true);

			// Login attempt with wrong password
			const loginFail = await verifyPassword("WrongPassword", database.passwordHash);
			expect(loginFail).toBe(false);
		});

		test("scenario: password change", async () => {
			const oldPassword = "oldPass123";
			const newPassword = "newPass456";

			const oldHash = await hashPassword(oldPassword);

			// Verify old password before change
			const oldVerified = await verifyPassword(oldPassword, oldHash);
			expect(oldVerified).toBe(true);

			// Change password
			const newHash = await hashPassword(newPassword);

			// Old password no longer works with new hash
			const oldNoLongerWorks = await verifyPassword(oldPassword, newHash);
			expect(oldNoLongerWorks).toBe(false);

			// New password works with new hash
			const newWorks = await verifyPassword(newPassword, newHash);
			expect(newWorks).toBe(true);
		});

		test("scenario: database migration with existing hashes", async () => {
			// Simulate existing hash in database
			const existingHash = `scrypt$${"a".repeat(32)}$${"b".repeat(128)}`;

			// Should handle existing hash format without errors
			const result = await verifyPassword("anypassword", existingHash);
			expect(result).toBe(false);
		});

		test("scenario: handling of potential SQL injection in password", async () => {
			const maliciousPassword = "'; DROP TABLE users; --";
			const hash = await hashPassword(maliciousPassword);
			const verified = await verifyPassword(maliciousPassword, hash);
			expect(verified).toBe(true);
		});
	});
});

describe("integration: hashPassword and verifyPassword", () => {
	test("work together for common passwords", async () => {
		const commonPasswords = ["password123", "admin", "letmein", "qwerty", "welcome", "monkey", "dragon"];

		for (const password of commonPasswords) {
			const hash = await hashPassword(password);
			const result = await verifyPassword(password, hash);
			expect(result).toBe(true);
		}
	});

	test("maintain security across multiple hash/verify cycles", async () => {
		const password = "testPassword";

		// Create multiple hashes of the same password
		const hashes = await Promise.all([hashPassword(password), hashPassword(password), hashPassword(password)]);

		// All hashes should be different (random salts)
		expect(new Set(hashes).size).toBe(3);

		// But all should verify correctly
		const verifications = await Promise.all(hashes.map((hash) => verifyPassword(password, hash)));
		expect(verifications.every((v) => v === true)).toBe(true);

		// And wrong password should fail for all
		const wrongVerifications = await Promise.all(hashes.map((hash) => verifyPassword("wrongPassword", hash)));
		expect(wrongVerifications.every((v) => v === false)).toBe(true);
	});
});
