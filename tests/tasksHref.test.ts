import {
	buildTasksHref,
	legacyWeekRedirectHref,
	resolveTasksTab,
	type TasksSearchParams,
	type TasksTab,
} from "@/lib/tasks/href";

test.each<[TasksSearchParams, TasksTab]>([
	[{}, "todo"],
	[{ tab: "todo" }, "todo"],
	[{ tab: "done" }, "done"],
	[{ tab: "manage" }, "todo"],
	[{ tab: "unknown" }, "todo"],
	[{ tab: ["done", "todo"] }, "done"],
	[{ tab: [] }, "todo"],
])("resolves the Tasks tab from %j", (params, expected) => {
	expect(resolveTasksTab(params, "DOER")).toBe(expected);
});

test("builds stable Tasks URLs, omitting the default tab and preserving range params", () => {
	expect(buildTasksHref("home", { userId: "all" })).toBe("/home/tasks?userId=all");
	// Without userId the remembered member cookie applies, so the menu entry keeps the last selection.
	expect(buildTasksHref("home", {})).toBe("/home/tasks");
	expect(buildTasksHref("home", { tab: "todo", userId: "sam" })).toBe("/home/tasks?userId=sam");
	expect(buildTasksHref("home", { tab: "done", userId: "sam", preset: "calendarWeek" })).toBe(
		"/home/tasks?tab=done&userId=sam&preset=calendarWeek",
	);
	expect(buildTasksHref("home", { tab: "todo", userId: "sam & alex", from: "2024-01-01", to: "2024-01-07" })).toBe(
		"/home/tasks?userId=sam+%26+alex&from=2024-01-01&to=2024-01-07",
	);
});

test("redirects a legacy week URL without a range to the default tab", () => {
	expect(legacyWeekRedirectHref("home", {})).toBe("/home/tasks");
	expect(legacyWeekRedirectHref("home", { userId: "sam" })).toBe("/home/tasks?userId=sam");
});

test.each([{ preset: "calendarWeek" }, { from: "2024-01-01" }, { to: "2024-01-07" }, { preset: "" }])(
	"redirects any legacy range to Done: %j",
	(range) => {
		const href = new URL(legacyWeekRedirectHref("home", { userId: "all", tab: "todo", ...range }), "https://tskr.test");
		expect(href.pathname).toBe("/home/tasks");
		expect(href.searchParams.get("tab")).toBe("done");
		expect(href.searchParams.get("userId")).toBe("all");
		for (const [key, value] of Object.entries(range)) expect(href.searchParams.get(key)).toBe(value);
	},
);

test("forwards every legacy query param, including repeated values and an explicit tab", () => {
	expect(
		legacyWeekRedirectHref("home", { tab: "done", userId: "sam", extra: ["one", "two"], missing: undefined }),
	).toBe("/home/tasks?tab=done&userId=sam&extra=one&extra=two");
});

test.each(["APPROVER", "DICTATOR", "DOER"] as const)("resolves Manage for %s", (role) => {
	expect(resolveTasksTab({ tab: "manage" }, role)).toBe(role === "DOER" ? "todo" : "manage");
	expect(resolveTasksTab({ tab: ["manage", "done"] }, role)).toBe(role === "DOER" ? "todo" : "manage");
	expect(resolveTasksTab({ tab: "done" }, role)).toBe("done");
});

test("builds Manage URLs with optional member and preserved ranges", () => {
	expect(buildTasksHref("home", { tab: "manage" })).toBe("/home/tasks?tab=manage");
	expect(
		buildTasksHref("home", {
			tab: "manage",
			userId: "sam",
			preset: "calendarWeek",
			from: "2024-01-01",
			to: "2024-01-07",
		}),
	).toBe("/home/tasks?tab=manage&userId=sam&preset=calendarWeek&from=2024-01-01&to=2024-01-07");
});
