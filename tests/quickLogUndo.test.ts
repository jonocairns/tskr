/** @jest-environment jsdom */
jest.mock("next/navigation", () => ({ useRouter: () => ({ refresh: mockRefresh }) }));
jest.mock("@/hooks/useToast", () => ({ useToast: () => ({ toast: mockToast }) }));
jest.mock("@/lib/i18nClient", () => ({ useTranslation: () => ({ t: (key: string) => key }) }));
jest.mock("@/lib/trpc/react", () => ({
	trpc: {
		useUtils: () => ({ logs: { invalidate: mockInvalidate } }),
		logs: {
			create: {
				useMutation: (options: typeof mockOptions) => {
					mockOptions = options;
					return { mutate: mockCreate, isPending: false };
				},
			},
			updateStatus: {
				useMutation: (options: typeof mockRevertOptions) => {
					mockRevertOptions = options;
					return { mutate: mockRevert };
				},
			},
		},
	},
}));

import { act, createElement, type ReactElement } from "react";
import { createRoot } from "react-dom/client";
import { TaskActionsProvider, useTaskActions } from "@/components/task-actions/Context";

const mockToast = jest.fn();
const mockCreate = jest.fn();
const mockRevert = jest.fn();
const mockRefresh = jest.fn();
const mockInvalidate = jest.fn();
let mockOptions: { onSuccess: (data: unknown) => void };
let mockRevertOptions: { onSuccess: () => void };
beforeEach(() => jest.clearAllMocks());
(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
const Trigger = () => {
	const { logPreset } = useTaskActions();
	return createElement("button", { type: "button", onClick: () => logPreset({ presetId: "preset" }) }, "Log");
};

test.each([
	{ entryId: "extra-log", countedTowards: null, title: "Task logged" },
	{
		entryId: "matched-log",
		countedTowards: { id: "task", label: "Bins", assigneeName: "Sam" },
		title: "Counted towards {{name}}'s {{task}}",
	},
])("Quick log toast Undo reverts the returned entry ($title)", async ({ entryId, countedTowards, title }) => {
	const container = document.createElement("div");
	const root = createRoot(container);
	await act(async () =>
		root.render(
			createElement(TaskActionsProvider, {
				householdId: "home",
				currentUserId: "user",
				currentUserRole: "DOER",
				presets: [],
				// biome-ignore lint/correctness/noChildrenProp: provider requires children in its props type
				children: createElement(Trigger),
			}),
		),
	);
	await act(async () => container.querySelector("button")?.click());
	expect(mockCreate).toHaveBeenCalledWith(expect.objectContaining({ presetId: "preset" }), expect.anything());
	await act(async () => mockOptions.onSuccess({ entry: { id: entryId, status: "APPROVED" }, countedTowards }));
	const toast = mockToast.mock.calls.at(-1)?.[0] as {
		title: string;
		duration: number;
		action: ReactElement<{ onClick: () => void }>;
	};
	expect(toast).toMatchObject({ title, duration: 8000 });
	toast.action.props.onClick();
	toast.action.props.onClick();
	expect(mockRevert).toHaveBeenCalledTimes(1);
	expect(mockRevert.mock.calls[0]?.[0]).toEqual({ id: entryId, action: "revert" });
	mockInvalidate.mockClear();
	mockRefresh.mockClear();
	await act(async () => mockRevertOptions.onSuccess());
	expect(mockToast).toHaveBeenLastCalledWith(expect.objectContaining({ title: "Entry reverted" }));
	expect(mockInvalidate).toHaveBeenCalled();
	expect(mockRefresh).toHaveBeenCalled();
	await act(async () => root.unmount());
});
