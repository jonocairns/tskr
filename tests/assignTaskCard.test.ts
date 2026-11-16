/** @jest-environment jsdom */

jest.mock("@/components/task-actions/PresetIconPicker", () => ({ PresetIconPicker: () => null }));
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
let mockOptions: { onSuccess: (result: { preset: typeof preset }) => void };
(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

Object.defineProperty(globalThis, "ResizeObserver", {
	configurable: true,
	value: class {
		observe = () => undefined;
		unobserve = () => undefined;
		disconnect = () => undefined;
	},
});

test("an inline task stays selected until server props adopt it, then disappears when removed upstream", async () => {
	const container = document.createElement("div");
	document.body.append(container);
	const root = createRoot(container);
	const original = { ...preset, id: "original", label: "Bins" };
	const render = async (records: (typeof preset)[]) =>
		act(async () =>
			root.render(
				createElement(AssignTaskCard, {
					householdId: "home",
					currentUserId: "approver",
					members: [{ id: "approver", name: "Alex", email: null }],
					presets: mapPresetSummaries(records),
				}),
			),
		);
	const picker = () => container.querySelector("#preset");
	try {
		await render([original]);
		await act(async () => mockOptions.onSuccess({ preset }));
		expect(picker()?.textContent).toBe("Water plants");
		await render([original, preset]);
		expect(picker()?.textContent).toBe("Water plants");
		await render([original]);
		expect(picker()?.textContent).toBe("Bins");
		expect(Array.from(container.querySelectorAll("option")).some((option) => option.value === preset.id)).toBe(false);
	} finally {
		await act(async () => root.unmount());
		container.remove();
	}
});
