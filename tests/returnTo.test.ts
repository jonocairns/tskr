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
});

test("blocks control characters", () => {
	expect(resolveReturnTo("/\n")).toBe("/");
	expect(resolveReturnTo("/%0A")).toBe("/");
});

test("returns / on invalid encoding", () => {
	expect(resolveReturnTo("%E0%A4")).toBe("/");
});
