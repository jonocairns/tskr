/** @jest-environment jsdom */

jest.mock("@/components/task-actions/PresetIconPicker", () => ({ PresetIconPicker: () => null }));
jest.mock("@/components/task-actions/presetIcons", () => ({ PresetIconGlyph: () => null }));
jest.mock("next/navigation", () => ({ useRouter: () => ({ refresh: jest.fn() }) }));
jest.mock("@/hooks/useToast", () => ({ useToast: () => ({ toast: jest.fn() }) }));
jest.mock("@/lib/i18nClient", () => ({ useTranslation: () => ({ t: (key: string) => key }) }));
jest.mock("@/lib/trpc/react", () => ({
	trpc: {
		useUtils: () => ({ presets: { invalidate: jest.fn() } }),
		assignedTasks: {
			create: { useMutation: () => ({ mutate: jest.fn(), isPending: false }) },
			createWithPreset: {
				useMutation: (options: typeof mockOptions) => {
					mockOptions = options;
					return { mutate: jest.fn(), isPending: false };
				},
			},
		},
	},
}));

import { act, createElement } from "react";
import { createRoot } from "react-dom/client";
import { AssignTaskCard } from "@/components/AssignTaskCard";
import { mapPresetSummaries } from "@/lib/dashboard/presets";

const preset = {
	id: "created",
	label: "Water plants",
	bucket: "QUICK",
	templateKey: null,
	iconKey: null,
	isShared: true,
	sortOrder: 0,
	createdById: "approver",
	approvalOverride: null,
	createdAt: new Date(),
};
let mockOptions: { onSuccess: (result: { preset: typeof preset; assignedTask: { id: string } }) => void };
(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

Object.defineProperty(globalThis, "ResizeObserver", {
	configurable: true,
	value: class {
		observe = () => undefined;
		unobserve = () => undefined;
		disconnect = () => undefined;
	},
});

test("adding an inline task resets the form, keeps the task selectable until server props adopt it, then drops it when removed upstream", async () => {
	const container = document.createElement("div");
	document.body.append(container);
	const root = createRoot(container);
	const onTaskAdded = jest.fn();
	const original = { ...preset, id: "original", label: "Bins" };
	const render = async (records: (typeof preset)[]) =>
		act(async () =>
			root.render(
				createElement(AssignTaskCard, {
					householdId: "home",
					currentUserId: "approver",
					members: [{ id: "approver", name: "Alex", email: null }],
					presets: mapPresetSummaries(records),
					existingTasks: [],
					onTaskAdded,
				}),
			),
		);
	const picker = () => container.querySelector("#preset");
	const hasOption = (id: string) =>
		Array.from(container.querySelectorAll("option")).some((option) => option.value === id);
	const nameInput = () => container.querySelector<HTMLInputElement>("#new-preset-label");
	try {
		await render([original]);
		expect(picker()?.textContent).toBe("New task…");
		await act(async () => mockOptions.onSuccess({ preset, assignedTask: { id: "task-1" } }));
		expect(onTaskAdded).toHaveBeenCalledWith("task-1");
		expect(picker()?.textContent).toBe("New task…");
		expect(nameInput()?.value).toBe("");
		expect(document.activeElement).toBe(nameInput());
		expect(container.querySelector("button[type=submit]")?.textContent).toBe("Added");
		expect(hasOption(preset.id)).toBe(true);
		await render([original, preset]);
		expect(hasOption(preset.id)).toBe(true);
		await render([original]);
		expect(hasOption(preset.id)).toBe(false);
	} finally {
		await act(async () => root.unmount());
		container.remove();
	}
});

test("the add status and its View action clear once the added task is removed from the list", async () => {
	const container = document.createElement("div");
	document.body.append(container);
	const root = createRoot(container);
	const added = { id: "task-1", presetId: preset.id, presetLabel: preset.label, assigneeId: null };
	const render = async (existingTasks: (typeof added)[]) =>
		act(async () =>
			root.render(
				createElement(AssignTaskCard, {
					householdId: "home",
					currentUserId: "approver",
					members: [{ id: "approver", name: "Alex", email: null }],
					presets: mapPresetSummaries([preset]),
					existingTasks,
					onViewTask: jest.fn(),
				}),
			),
		);
	const viewButton = () =>
		Array.from(container.querySelectorAll("button")).find((button) => button.textContent === "View");
	try {
		await render([]);
		await act(async () => mockOptions.onSuccess({ preset, assignedTask: { id: "task-1" } }));
		expect(viewButton()).toBeDefined();
		// The refreshed list includes the new task, then a later refresh no longer does.
		await render([added]);
		expect(viewButton()).toBeDefined();
		await render([]);
		expect(viewButton()).toBeUndefined();
	} finally {
		await act(async () => root.unmount());
		container.remove();
	}
});
