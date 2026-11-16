/** @jest-environment jsdom */

jest.mock("next/navigation", () => ({ useRouter: () => ({ refresh: mockRefresh }) }));
jest.mock("@/hooks/useToast", () => ({ useToast: () => ({ toast: mockToast }) }));
jest.mock("@/lib/i18nClient", () => ({
	useTranslation: () => ({
		t: (key: string, params: Record<string, unknown> = {}) =>
			key.replace(/\{\{(\w+)\}\}/g, (_, name) => String(params[name])),
	}),
}));
jest.mock("@/components/task-actions/Context", () => ({
	useTaskActions: () => ({ householdId: "home", currentUserRole: mockRole }),
}));
jest.mock("@/lib/trpc/react", () => ({
	trpc: {
		assignedTasks: {
			complete: {
				useMutation: (options: typeof mockCompletionOptions) => {
					mockCompletionOptions = options;
					return { mutate: mockComplete, isPending: false };
				},
			},
		},
		presets: {
			usage: {
				useQuery: (input: unknown, options: unknown) => {
					mockUsageQuery(input, options);
					return mockUsage;
				},
			},
		},
	},
}));

import { act, createElement } from "react";
import { createRoot, type Root } from "react-dom/client";
import { type AssignedTaskEntry, AssignedTaskQueue } from "@/components/AssignedTaskQueue";
import { PresetDeleteDialog } from "@/components/task-actions/PresetDeleteDialog";

const mockComplete = jest.fn();
const mockRefresh = jest.fn();
const mockToast = jest.fn();
const mockUsageQuery = jest.fn();
const mockDelete = jest.fn();
let mockRole = "APPROVER";
let mockCompletionOptions: { onError: (error: { message: string; data: { code: string } }) => void };
let mockUsage = {
	data: {
		tasks: [
			{ preset: { label: "Bins" }, assignedTo: { name: "Sam", email: null } },
			{ preset: { label: "Vacuum lounge" }, assignedTo: null },
		],
	},
	isFetching: false,
	isPending: false,
	isError: false,
	refetch: jest.fn(),
};
let container: HTMLDivElement;
let root: Root;
(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const entry = (group: AssignedTaskEntry["group"], overrides: Partial<AssignedTaskEntry> = {}) => ({
	id: group,
	group,
	label: group,
	assigneeLabel: "Sam",
	state: "available" as const,
	pendingCompleters: [],
	presetId: "preset",
	bucket: "QUICK" as const,
	points: 3,
	assignedAt: "2024-01-01T00:00:00.000Z",
	cadenceTarget: 1,
	cadenceIntervalMinutes: 10080,
	isRecurring: true,
	progress: 0,
	completedLastCycle: false,
	lastCompletedAt: null,
	nextResetAt: null,
	...overrides,
});
const renderBoard = async (entries: AssignedTaskEntry[], doneThisWeek = 0) =>
	act(async () =>
		root.render(
			createElement(AssignedTaskQueue, {
				entries,
				doneThisWeek,
				householdId: "home",
				timeZone: "UTC",
				dateFormat: "DMY",
				timeFormat: "H24",
			}),
		),
	);
const button = (label: string) => {
	const found = Array.from(document.querySelectorAll("button")).find(
		(element) => element.getAttribute("aria-label") === label || element.textContent === label,
	);
	if (!found) throw new Error(`Missing button: ${label}`);
	return found;
};
const click = async (label: string) => act(async () => button(label).click());
const renderDelete = async () =>
	act(async () =>
		root.render(
			createElement(PresetDeleteDialog, {
				presetId: "preset",
				label: "Bins",
				onDelete: mockDelete,
				// biome-ignore lint/correctness/noChildrenProp: React requires the component's mandatory children prop in createElement.
				children: createElement("button", { type: "button" }, "Delete preset"),
			}),
		),
	);

beforeEach(() => {
	jest.clearAllMocks();
	mockRole = "APPROVER";
	mockUsage = { ...mockUsage, isFetching: false, isPending: false, isError: false };
	container = document.createElement("div");
	document.body.append(container);
	root = createRoot(container);
});
afterEach(async () => {
	await act(async () => root.unmount());
	container.remove();
});

test("own and Open tasks complete in one tap; someone else's task requires confirmation", async () => {
	await renderBoard([entry("mine"), entry("open"), entry("others")]);
	await click("Complete mine");
	await click("Complete open");
	expect(mockComplete.mock.calls).toEqual([
		[{ householdId: "home", id: "mine" }],
		[{ householdId: "home", id: "open" }],
	]);
	await click("Complete others");
	expect(mockComplete).toHaveBeenCalledTimes(2);
	expect(document.querySelector('[role="alertdialog"]')?.textContent).toContain("assigned to Sam");
	await click("Cancel");
	expect(mockComplete).toHaveBeenCalledTimes(2);
	await click("Complete others");
	await act(async () => {
		const confirm = document.querySelector<HTMLButtonElement>('[role="alertdialog"] button:last-child');
		if (!confirm) throw new Error("Missing confirmation");
		confirm.click();
	});
	expect(mockComplete).toHaveBeenLastCalledWith({ householdId: "home", id: "others" });
});

test("pending rows name the completer, have no complete button, and stale completions show the server message and refresh", async () => {
	await renderBoard([entry("open", { state: "awaitingApproval", pendingCompleters: ["Alex"], progress: 1 })]);
	expect(container.textContent).toContain("Awaiting approval, done by Alex");
	expect(container.querySelector('button[aria-label="Complete open"]')).toBeNull();
	await act(async () =>
		mockCompletionOptions.onError({
			message: "Task already completed for this cadence",
			data: { code: "BAD_REQUEST" },
		}),
	);
	expect(mockToast).toHaveBeenCalledWith(
		expect.objectContaining({ description: "Task already completed for this cadence" }),
	);
	expect(mockRefresh).toHaveBeenCalledTimes(1);
});

test("long others sections start collapsed and done links also work on an empty board", async () => {
	await renderBoard(Array.from({ length: 6 }, (_, index) => entry("others", { id: String(index) })));
	expect(container.querySelector("details")?.open).toBe(false);
	await renderBoard([], 2);
	expect(container.querySelector('a[href*="tab=done"]')?.getAttribute("href")).toBe(
		"/home/tasks?tab=done&userId=all&preset=calendarWeek",
	);
	expect(container.querySelector('a[href*="tab=done"]')?.textContent).toBe("2 done this week →");
	await renderBoard([], 0);
	expect(container.querySelector('a[href*="tab=done"]')).toBeNull();
	expect(container.querySelector("a")?.getAttribute("href")).toBe("/home/tasks?userId=all");
	expect(container.querySelector("a")?.textContent).toBe("All tasks →");
});

test("preset deletion loads usage only when opened by an approver and names assigned and Open tasks", async () => {
	await renderDelete();
	expect(mockUsageQuery).toHaveBeenLastCalledWith({ householdId: "home", id: "preset" }, { enabled: false });
	await click("Delete preset");
	expect(mockUsageQuery).toHaveBeenLastCalledWith({ householdId: "home", id: "preset" }, { enabled: true });
	expect(document.querySelector('[role="alertdialog"]')?.textContent).toContain(
		"This will also remove: Bins (Sam), Vacuum lounge (Open)",
	);
	await click("Delete");
	expect(mockDelete).toHaveBeenCalledTimes(1);
});

test("preset deletion waits for usage, with retry on failure, while doers do not query usage", async () => {
	mockUsage = { ...mockUsage, isFetching: true, isPending: true };
	await renderDelete();
	await click("Delete preset");
	expect(button("Delete").disabled).toBe(true);
	mockUsage = { ...mockUsage, isFetching: false, isPending: false, isError: true };
	await renderDelete();
	expect(button("Delete").disabled).toBe(true);
	await click("Retry");
	expect(mockUsage.refetch).toHaveBeenCalledTimes(1);
	await click("Cancel");
	mockRole = "DOER";
	await renderDelete();
	await click("Delete preset");
	expect(mockUsageQuery).toHaveBeenLastCalledWith({ householdId: "home", id: "preset" }, { enabled: false });
	expect(button("Delete").disabled).toBe(false);
});
