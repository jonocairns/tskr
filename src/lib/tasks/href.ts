import type { HouseholdRole } from "@prisma/client";

export type TasksTab = "todo" | "done" | "manage";
export type TasksSearchParams = Record<string, string | string[] | undefined>;

export const getSingleSearchParamValue = (value?: string | string[]) =>
	(Array.isArray(value) ? value[0] : value) ?? null;

export const resolveTasksTab = (searchParams: TasksSearchParams, role: HouseholdRole) => {
	const tab = getSingleSearchParamValue(searchParams.tab);
	if (tab === "manage" && role !== "DOER") return "manage";
	return tab === "done" ? "done" : "todo";
};

export const buildTasksHref = (
	householdId: string,
	{
		tab = "todo",
		userId,
		preset,
		from,
		to,
	}: {
		tab?: TasksTab;
		// Omit to let the remembered member cookie decide (e.g. plain navigation entries).
		userId?: string;
		preset?: string | null;
		from?: string | null;
		to?: string | null;
	},
) => {
	const params = new URLSearchParams();
	if (tab !== "todo") params.set("tab", tab);
	if (userId) params.set("userId", userId);
	if (preset != null) params.set("preset", preset);
	if (from != null) params.set("from", from);
	if (to != null) params.set("to", to);
	const query = params.toString();
	return `/${householdId}/tasks${query ? `?${query}` : ""}`;
};

export const legacyWeekRedirectHref = (householdId: string, searchParams: TasksSearchParams) => {
	const params = new URLSearchParams();
	for (const [key, value] of Object.entries(searchParams)) {
		for (const item of Array.isArray(value) ? value : value === undefined ? [] : [value]) {
			params.append(key, item);
		}
	}
	if (["preset", "from", "to"].some((key) => searchParams[key] !== undefined)) params.set("tab", "done");
	const query = params.toString();
	return `/${householdId}/tasks${query ? `?${query}` : ""}`;
};
