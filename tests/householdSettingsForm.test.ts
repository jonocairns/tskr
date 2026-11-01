/** @jest-environment jsdom */

jest.mock("next/navigation", () => ({ useRouter: () => ({ refresh: mockRefresh }) }));
jest.mock("@/hooks/useToast", () => ({ useToast: () => ({ toast: jest.fn() }) }));
jest.mock("@/lib/i18nClient", () => ({ useTranslation: () => ({ t: (key: string) => key }) }));
jest.mock("@/lib/trpc/react", () => ({
	trpc: {
		useUtils: () => mockUtils,
		households: {
			getCurrent: { useQuery: () => ({ data: mockQueryData, isLoading: false, error: null }) },
			getMembers: { useQuery: () => ({ data: { members: [] } }) },
			updateCurrent: {
				useMutation: (options: { onSuccess: typeof mockOnSuccess }) => {
					mockOnSuccess = options.onSuccess;
					return { mutate: mockMutate, isPending: mockPending };
				},
			},
		},
	},
}));

import type { inferRouterOutputs } from "@trpc/server";
import { act, createElement } from "react";
import { createRoot, type Root } from "react-dom/client";
import { SettingsCard } from "@/components/household/SettingsCard";
import type { AppRouter } from "@/server/routers/_app";

type SettingsResponse = inferRouterOutputs<AppRouter>["households"]["getCurrent"];

const response = (overrides: Partial<SettingsResponse["household"]> = {}) =>
	({
		household: {
			id: "home",
			createdById: "alice",
			name: "Our home",
			rewardThreshold: 50,
			rewardClaimRevision: 0,
			progressBarColor: null,
			timeZone: "UTC",
			dateFormat: "DMY",
			timeFormat: "H24",
			rewardClaimLimits: [
				{
					id: "rule-1",
					householdId: "home",
					maxClaims: 2,
					period: "WEEK",
					scope: "HOUSEHOLD",
					userId: null,
					windowMinutes: null,
					sortOrder: 0,
					rolloverEnabled: false,
					archivedAt: null,
				},
			],
			...overrides,
		},
		timeZones: ["UTC", "Pacific/Auckland"],
	}) satisfies SettingsResponse;

let mockQueryData: SettingsResponse;
let mockCacheData: SettingsResponse | undefined;
let mockPending = false;
let mockOnSuccess: (result: { household: SettingsResponse["household"] }) => Promise<void>;
const mockMutate = jest.fn();
const mockRefresh = jest.fn();
const mockUtils = {
	households: {
		getCurrent: {
			getData: jest.fn(() => mockCacheData),
			setData: jest.fn(
				(_input: unknown, update: (cached: SettingsResponse | undefined) => SettingsResponse | undefined) => {
					mockCacheData = update(mockCacheData);
				},
			),
			cancel: jest.fn(async () => undefined),
			invalidate: jest.fn(async () => undefined),
		},
	},
};

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
Object.defineProperty(globalThis, "ResizeObserver", {
	configurable: true,
	value: class {
		observe = () => undefined;
		unobserve = () => undefined;
		disconnect = () => undefined;
	},
});

let container: HTMLDivElement;
let root: Root;
const render = async () => {
	await act(async () => root.render(createElement(SettingsCard, { householdId: "home", canManage: true })));
};
const getInput = (selector: string) => {
	const element = container.querySelector<HTMLInputElement>(selector);
	if (!element) throw new Error(`Input not found: ${selector}`);
	return element;
};
const input = (id: string) => getInput(`#${id}`);
const countInput = () => getInput('input[id$="-count"]');
const button = (text: string) => {
	const element = Array.from(container.querySelectorAll("button")).find((item) => item.textContent === text);
	if (!element) throw new Error(`Button not found: ${text}`);
	return element;
};
const saveButton = () => button("Save changes");
const edit = async (element: HTMLInputElement, value: string) => {
	await act(async () => {
		Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")?.set?.call(element, value);
		element.dispatchEvent(new Event("input", { bubbles: true }));
	});
};
const refresh = async (next: SettingsResponse) => {
	mockQueryData = next;
	mockCacheData = next;
	await render();
};
const save = async () => {
	await act(async () => saveButton().click());
};
const submittedFields = () => JSON.parse(JSON.stringify(mockMutate.mock.calls[0][0]));

beforeEach(async () => {
	jest.clearAllMocks();
	mockQueryData = response();
	mockCacheData = mockQueryData;
	mockPending = false;
	container = document.createElement("div");
	document.body.append(container);
	root = createRoot(container);
	await render();
});

afterEach(async () => {
	await act(async () => root.unmount());
	container.remove();
});

test("a refresh preserves edited limits, then applies when those edits are reverted", async () => {
	await edit(countInput(), "1");
	await refresh(response({ name: "Renamed by another manager", rewardThreshold: 100, progressBarColor: "#123456" }));
	expect(countInput().value).toBe("1");
	expect(input("household-name").value).toBe("Our home");
	expect(input("household-threshold").value).toBe("50");
	await edit(countInput(), "2");
	expect(input("household-name").value).toBe("Renamed by another manager");
	expect(input("household-threshold").value).toBe("100");
	expect(input("household-progress-color").value).toBe("#123456");
	expect(saveButton().disabled).toBe(true);
});

test("saving edited limits omits unchanged fields even when a newer response is waiting", async () => {
	await edit(countInput(), "1");
	await refresh(
		response({ name: "New name", rewardThreshold: 100, progressBarColor: "#123456", rewardClaimRevision: 9 }),
	);
	await save();
	expect(submittedFields()).toEqual({
		householdId: "home",
		rewardClaimRevision: 0,
		rewardClaimLimits: [
			{
				id: "rule-1",
				rolloverEnabled: false,
				maxClaims: 1,
				period: "WEEK",
				scope: "HOUSEHOLD",
				userId: null,
				windowMinutes: null,
			},
		],
	});
});

test("the newest waiting refresh is applied after undoing a removal", async () => {
	const remove = button("Remove limit");
	await act(async () => remove.click());
	await refresh(response({ name: "First update" }));
	await refresh(response({ name: "Latest update", rewardThreshold: 75 }));
	expect(input("household-name").value).toBe("Our home");
	const undo = button("Undo removal");
	await act(async () => undo.click());
	expect(countInput().value).toBe("2");
	expect(input("household-name").value).toBe("Latest update");
	expect(input("household-threshold").value).toBe("75");
});

test("a successful save updates the cache and cannot be reset by the previously skipped query response", async () => {
	await edit(countInput(), "1");
	const skipped = response({ name: "New name", rewardThreshold: 100, progressBarColor: "#123456" });
	await refresh(skipped);
	await save();
	mockPending = true;
	await render();
	const saved = response({
		...skipped.household,
		rewardClaimLimits: skipped.household.rewardClaimLimits.map((rule) => ({ ...rule, id: "new-rule", maxClaims: 1 })),
	});
	await act(async () => mockOnSuccess({ household: saved.household }));
	mockPending = false;
	// Leave the observer on its old snapshot to exercise delayed query notifications.
	await render();
	expect(mockUtils.households.getCurrent.cancel).toHaveBeenCalledWith({ householdId: "home" });
	expect(mockCacheData?.household).toEqual(saved.household);
	expect(input("household-name").value).toBe("New name");
	expect(input("household-threshold").value).toBe("100");
	expect(countInput().value).toBe("1");
	expect(saveButton().disabled).toBe(true);
	if (!mockCacheData) throw new Error("Expected saved settings in the cache");
	mockQueryData = mockCacheData;
	await render();
	expect(countInput().value).toBe("1");
});

test("a name-only edit submits only the name", async () => {
	await edit(input("household-name"), "My renamed home");
	await save();
	expect(submittedFields()).toEqual({ householdId: "home", name: "My renamed home" });
});

test("a threshold-only edit submits only the threshold", async () => {
	await edit(input("household-threshold"), "75");
	await save();
	expect(submittedFields()).toEqual({ householdId: "home", rewardThreshold: 75 });
});

test("clearing a custom color submits null without sending unrelated settings", async () => {
	await refresh(response({ progressBarColor: "#123456" }));
	await act(async () => container.querySelector<HTMLButtonElement>("#household-progress-color-enabled")?.click());
	await save();
	expect(submittedFields()).toEqual({ householdId: "home", progressBarColor: null });
});

test("monthly carryover has one toggle and retains rule identity and revision in an edited-fields-only save", async () => {
	await refresh(
		response({
			rewardClaimRevision: 3,
			rewardClaimLimits: mockQueryData.household.rewardClaimLimits.map((rule) => ({
				...rule,
				period: "MONTH",
				rolloverEnabled: false,
			})),
		}),
	);
	const toggle = container.querySelector<HTMLButtonElement>("[id$='-rollover']");
	if (!toggle) throw new Error("Expected carryover toggle");
	expect(toggle.getAttribute("aria-checked")).toBe("false");
	await act(async () => toggle.click());
	await save();
	expect(submittedFields()).toMatchObject({
		householdId: "home",
		rewardClaimRevision: 3,
		rewardClaimLimits: [{ id: "rule-1", rolloverEnabled: true, period: "MONTH" }],
	});
	expect(Object.keys(submittedFields()).sort()).toEqual(["householdId", "rewardClaimLimits", "rewardClaimRevision"]);
	expect(container.textContent).toContain("Monthly changes take effect next month.");
});
