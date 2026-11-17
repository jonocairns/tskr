/** @jest-environment jsdom */

jest.mock("next/navigation", () => ({ useRouter: () => ({ refresh: jest.fn() }) }));
jest.mock("@/hooks/useToast", () => ({ useToast: () => ({ toast: jest.fn() }) }));
jest.mock("@/lib/i18nClient", () => ({ useTranslation: () => ({ t: (key: string) => key }) }));
jest.mock("@/lib/trpc/react", () => ({
	trpc: {
		assignedTasks: {
			update: { useMutation: () => ({ mutate: jest.fn(), isPending: false }) },
			delete: { useMutation: () => ({ mutate: jest.fn(), isPending: false }) },
		},
	},
}));

import { act, createElement } from "react";
import { createRoot } from "react-dom/client";
import { AssignedTasksManager } from "@/components/AssignedTasksManager";

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

Object.defineProperty(globalThis, "ResizeObserver", {
	configurable: true,
	value: class {
		observe = () => undefined;
		unobserve = () => undefined;
		disconnect = () => undefined;
	},
});

const makeTask = (id: string, cadenceTarget: number) => ({
	id,
	presetId: `preset-${id}`,
	presetLabel: `Task ${id}`,
	assigneeId: null,
	assigneeName: null,
	assigneeEmail: null,
	cadenceTarget,
	cadenceIntervalMinutes: 10080,
	isRecurring: true,
	assignedAt: new Date(2026, 0, id === "a" ? 2 : 1).toISOString(),
	progress: { completed: 0, target: cadenceTarget, isRecurring: true },
});

// React tracks input values itself, so set through the native setter before dispatching.
const typeInto = (input: HTMLInputElement, value: string) => {
	Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")?.set?.call(input, value);
	input.dispatchEvent(new Event("input", { bubbles: true }));
};

const setup = () => {
	const container = document.createElement("div");
	document.body.append(container);
	const root = createRoot(container);
	const render = async (tasks: ReturnType<typeof makeTask>[]) =>
		act(async () =>
			root.render(
				createElement(AssignedTasksManager, {
					householdId: "home",
					initialTasks: tasks,
					members: [{ id: "approver", name: "Alex", email: null }],
				}),
			),
		);
	const target = (id: string) => container.querySelector<HTMLInputElement>(`#cadence-${id}`);
	const cleanup = async () => {
		await act(async () => root.unmount());
		container.remove();
	};
	return { render, target, cleanup };
};

test("a server refresh keeps another row's unsaved edits and takes fresh values for clean rows", async () => {
	const { render, target, cleanup } = setup();
	try {
		await render([makeTask("a", 1), makeTask("b", 1)]);
		await act(async () => typeInto(target("a") as HTMLInputElement, "3"));
		expect(target("a")?.value).toBe("3");

		// A refresh (e.g. after adding a task) brings a server-side change to the clean row.
		await render([makeTask("a", 1), makeTask("b", 2)]);
		expect(target("a")?.value).toBe("3");
		expect(target("b")?.value).toBe("2");
	} finally {
		await cleanup();
	}
});

test("the per-period field can be cleared while retyping and clamps to 1 on blur", async () => {
	const { render, target, cleanup } = setup();
	try {
		await render([makeTask("a", 2)]);
		const input = target("a") as HTMLInputElement;
		await act(async () => typeInto(input, ""));
		expect(target("a")?.value).toBe("");
		await act(async () => {
			input.dispatchEvent(new FocusEvent("focusout", { bubbles: true }));
		});
		expect(target("a")?.value).toBe("1");
	} finally {
		await cleanup();
	}
});
