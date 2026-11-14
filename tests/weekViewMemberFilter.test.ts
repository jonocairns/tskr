import { getWeekViewMemberCookieName, resolveWeekViewMember } from "@/lib/week-view/memberFilter";

test.each([
	{ query: "sam", cookie: "alex", expected: "sam" },
	{ query: "all", cookie: "sam", expected: "all" },
	{ query: "removed-member", cookie: "alex", expected: "alex" },
	{ query: "invalid", cookie: "all", expected: "all" },
	{ query: null, cookie: "sam", expected: "sam" },
	{ query: "", cookie: "alex", expected: "alex" },
	{ query: "alex", cookie: "removed-member", expected: "alex" },
	{ query: "removed-member", cookie: "removed-member", expected: "all" },
	{ query: null, cookie: "", expected: "all" },
	{ expected: "all" },
])("resolves the week member filter: %j", ({ query, cookie, expected }) => {
	expect(resolveWeekViewMember({ query, cookie, memberIds: ["sam", "alex"] })).toBe(expected);
});

test("falls back to Everyone when a remembered member leaves the household", () => {
	expect(resolveWeekViewMember({ query: "sam", cookie: "sam", memberIds: [] })).toBe("all");
});

test("scopes the remembered selection to its household", () => {
	expect(getWeekViewMemberCookieName("household-a")).toBe("tskr-week-member-household-a");
	expect(getWeekViewMemberCookieName("household-b")).not.toBe(getWeekViewMemberCookieName("household-a"));
});
