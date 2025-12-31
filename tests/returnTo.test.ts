import { resolveReturnTo } from "../src/lib/returnTo";

test("returns / when value is null", () => {
	expect(resolveReturnTo(null)).toBe("/");
});

test("allows relative paths", () => {
	expect(resolveReturnTo("/dashboard")).toBe("/dashboard");
	expect(resolveReturnTo("/dashboard?tab=1")).toBe("/dashboard?tab=1");
});

test("blocks protocol-relative urls", () => {
	expect(resolveReturnTo("//evil.com")).toBe("/");
	expect(resolveReturnTo("%2F%2Fevil.com")).toBe("/");
});

test("blocks backslash paths", () => {
	expect(resolveReturnTo("\\\\evil.com")).toBe("/");
	expect(resolveReturnTo("/\\\\evil.com")).toBe("/");
	expect(resolveReturnTo("/%5Cevil.com")).toBe("/");
});

test("blocks control characters", () => {
	expect(resolveReturnTo("/\n")).toBe("/");
	expect(resolveReturnTo("/%0A")).toBe("/");
	expect(resolveReturnTo("/%00")).toBe("/");
});

test("returns / on invalid encoding", () => {
	expect(resolveReturnTo("%E0%A4")).toBe("/");
});

test("accepts encoded relative paths", () => {
	expect(resolveReturnTo("/dashboard%3Ftab%3D1")).toBe("/dashboard?tab=1");
});

describe("Multiple encoding layer attacks", () => {
	test("blocks double-encoded protocol-relative URLs", () => {
		// %252F%252F decodes to %2F%2F which decodes to //
		expect(resolveReturnTo("%252F%252Fevil.com")).toBe("/");
	});

	test("blocks triple-encoded protocol-relative URLs", () => {
		// %25252F%25252F -> %252F%252F -> %2F%2F -> //
		expect(resolveReturnTo("%25252F%25252Fevil.com")).toBe("/");
	});

	test("allows double-encoded backslash (single decode only)", () => {
		// %255C decodes to %5C (not decoded again), so it's allowed
		expect(resolveReturnTo("/%255Cevil.com")).toBe("/%5Cevil.com");
	});

	test("allows double-encoded null byte (single decode only)", () => {
		// %2500 decodes to %00 (literal text, not null byte)
		expect(resolveReturnTo("/%2500")).toBe("/%00");
	});

	test("allows double-encoded newline (single decode only)", () => {
		// %250A decodes to %0A (literal text, not newline)
		expect(resolveReturnTo("/%250A")).toBe("/%0A");
	});
});

describe("Unicode normalization attacks", () => {
	test("allows unicode slash lookalikes (not normalized)", () => {
		// U+2215 DIVISION SLASH (∕) - not the same as / in JavaScript string comparison
		expect(resolveReturnTo("/\u2215evil.com")).toBe("/∕evil.com");
		// U+FF0F FULLWIDTH SOLIDUS (／)
		expect(resolveReturnTo("/\uff0fevil.com")).toBe("/／evil.com");
	});

	test("allows unicode backslash lookalikes (not normalized)", () => {
		// U+2216 SET MINUS (∖) - not the same as \ in JavaScript string comparison
		expect(resolveReturnTo("/\u2216evil.com")).toBe("/∖evil.com");
		// U+FF3C FULLWIDTH REVERSE SOLIDUS (＼)
		expect(resolveReturnTo("/\uff3cevil.com")).toBe("/＼evil.com");
	});

	test("handles normalized unicode paths safely", () => {
		// Valid unicode in path segments should work
		expect(resolveReturnTo("/dashboard/über")).toBe("/dashboard/über");
		expect(resolveReturnTo("/dashboard/日本語")).toBe("/dashboard/日本語");
	});

	test("blocks zero-width characters at start", () => {
		// U+200B ZERO WIDTH SPACE
		expect(resolveReturnTo("\u200b/evil.com")).toBe("/");
		// U+FEFF ZERO WIDTH NO-BREAK SPACE (BOM)
		expect(resolveReturnTo("\ufeff/evil.com")).toBe("/");
	});
});

describe("Mixed encoding attacks", () => {
	test("blocks mixed case encoding", () => {
		// %2f (lowercase) should still decode to /
		expect(resolveReturnTo("%2f%2fevil.com")).toBe("/");
		expect(resolveReturnTo("%2F%2fevil.com")).toBe("/");
	});

	test("blocks partially encoded protocol-relative URL", () => {
		expect(resolveReturnTo("/%2Fevil.com")).toBe("/");
		expect(resolveReturnTo("%2F/evil.com")).toBe("/");
	});

	test("blocks mixed backslash encodings", () => {
		expect(resolveReturnTo("/\\%5Cevil.com")).toBe("/");
		expect(resolveReturnTo("/%5C\\evil.com")).toBe("/");
	});
});

describe("Whitespace and control character variations", () => {
	test("allows tab characters (not explicitly blocked)", () => {
		// Tab is not in the blocked character list (\0, \r, \n)
		expect(resolveReturnTo("/\t")).toBe("/\t");
		expect(resolveReturnTo("/%09")).toBe("/\t");
	});

	test("blocks carriage return", () => {
		expect(resolveReturnTo("/\r")).toBe("/");
		expect(resolveReturnTo("/%0D")).toBe("/");
	});

	test("allows vertical tab (not explicitly blocked)", () => {
		// Vertical tab is not in the blocked character list
		expect(resolveReturnTo("/%0B")).toBe("/\u000B");
	});

	test("allows form feed (not explicitly blocked)", () => {
		// Form feed is not in the blocked character list
		expect(resolveReturnTo("/%0C")).toBe("/\f");
	});

	test("allows normal spaces in paths", () => {
		expect(resolveReturnTo("/path%20with%20spaces")).toBe("/path with spaces");
	});

	test("blocks leading whitespace", () => {
		expect(resolveReturnTo(" /dashboard")).toBe("/");
		expect(resolveReturnTo("\n/dashboard")).toBe("/");
	});
});

describe("Fragment and query parameter edge cases", () => {
	test("allows fragments in relative URLs", () => {
		expect(resolveReturnTo("/dashboard#section")).toBe("/dashboard#section");
	});

	test("allows complex query strings", () => {
		expect(resolveReturnTo("/search?q=test&sort=asc&page=1")).toBe("/search?q=test&sort=asc&page=1");
	});

	test("allows encoded special characters in query", () => {
		expect(resolveReturnTo("/search?q=hello%20world")).toBe("/search?q=hello world");
	});

	test("blocks protocol-relative URL in fragment", () => {
		expect(resolveReturnTo("#//evil.com")).toBe("/");
	});

	test("allows relative path with encoded fragment", () => {
		expect(resolveReturnTo("/page%23section")).toBe("/page#section");
	});
});

describe("Path traversal with encoding", () => {
	test("allows path traversal in relative paths", () => {
		// Path traversal is allowed as long as it starts with /
		expect(resolveReturnTo("/dashboard/../admin")).toBe("/dashboard/../admin");
	});

	test("allows encoded dots in path", () => {
		expect(resolveReturnTo("/dashboard/%2E%2E/admin")).toBe("/dashboard/../admin");
	});

	test("blocks traversal that doesn't start with /", () => {
		expect(resolveReturnTo("..\\..\\..\\etc\\passwd")).toBe("/");
	});
});

describe("Overlong UTF-8 and invalid sequences", () => {
	test("blocks overlong encoded slash", () => {
		// Overlong UTF-8 encoding of / (should be rejected by decodeURIComponent)
		expect(resolveReturnTo("%C0%AF")).toBe("/");
		expect(resolveReturnTo("%E0%80%AF")).toBe("/");
	});

	test("handles invalid UTF-8 sequences gracefully", () => {
		// Invalid UTF-8 continuation bytes
		expect(resolveReturnTo("%80%80")).toBe("/");
		expect(resolveReturnTo("%C0%C0")).toBe("/");
	});

	test("blocks overlong encoded backslash", () => {
		expect(resolveReturnTo("%C0%5C")).toBe("/");
	});
});

describe("Bidirectional text attacks", () => {
	test("blocks right-to-left override", () => {
		// U+202E RIGHT-TO-LEFT OVERRIDE
		expect(resolveReturnTo("\u202e/evil.com")).toBe("/");
	});

	test("blocks left-to-right override", () => {
		// U+202D LEFT-TO-RIGHT OVERRIDE
		expect(resolveReturnTo("\u202d/evil.com")).toBe("/");
	});

	test("blocks other directional formatting", () => {
		// U+200E LEFT-TO-RIGHT MARK
		expect(resolveReturnTo("\u200e/evil.com")).toBe("/");
		// U+200F RIGHT-TO-LEFT MARK
		expect(resolveReturnTo("\u200f/evil.com")).toBe("/");
	});
});

describe("Hostname and protocol smuggling", () => {
	test("blocks URLs with @ symbol after //", () => {
		// Double slash is blocked, so this fails on that check
		expect(resolveReturnTo("//@evil.com")).toBe("/");
	});

	test("allows @ symbol in single-slash paths", () => {
		// @ is not explicitly blocked, only // prefix is blocked
		expect(resolveReturnTo("/user@evil.com")).toBe("/user@evil.com");
	});

	test("blocks encoded @ symbol after double slash", () => {
		// Double slash is blocked
		expect(resolveReturnTo("//%40evil.com")).toBe("/");
	});

	test("blocks colon after double slash", () => {
		// Double slash is blocked
		expect(resolveReturnTo("//:evil.com")).toBe("/");
	});

	test("allows @ in query parameters", () => {
		expect(resolveReturnTo("/contact?email=user@example.com")).toBe("/contact?email=user@example.com");
	});
});

describe("Empty and edge case inputs", () => {
	test("handles empty string", () => {
		expect(resolveReturnTo("")).toBe("/");
	});

	test("handles just slash", () => {
		expect(resolveReturnTo("/")).toBe("/");
	});

	test("handles very long paths", () => {
		const longPath = `/dashboard/${"a".repeat(1000)}`;
		expect(resolveReturnTo(longPath)).toBe(longPath);
	});

	test("handles encoded empty components", () => {
		expect(resolveReturnTo("/%20")).toBe("/ ");
	});
});
