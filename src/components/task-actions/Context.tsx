"use client";

import { useRouter } from "next/navigation";
import type { ReactNode } from "react";
import { createContext, useContext, useEffect, useRef, useState, useTransition } from "react";

import type { PresetOption, PresetSummary, PresetTemplate } from "@/components/task-actions/types";
import { ToastAction } from "@/components/ui/Toast";
import { useToast } from "@/hooks/useToast";
import { useTranslation } from "@/lib/i18nClient";
import { DEFAULT_DURATION_BUCKET, type DurationKey, PRESET_TASKS } from "@/lib/points";
import { trpc } from "@/lib/trpc/react";

type PresetPayload = { presetKey?: string; presetId?: string };

type TaskActionsContextValue = {
	householdId: string;
	presetOptions: PresetOption[];
	presetTemplates: PresetTemplate[];
	customPresets: PresetSummary[];
	setCustomPresets: React.Dispatch<React.SetStateAction<PresetSummary[]>>;
	currentUserId: string;
	currentUserRole: "DICTATOR" | "APPROVER" | "DOER";
	note: string;
	setNote: React.Dispatch<React.SetStateAction<string>>;
	defaultBucket: DurationKey;
	disabled: boolean;
	isPending: boolean;
	isPresetPending: boolean;
	startTransition: (callback: () => void) => void;
	startPresetTransition: (callback: () => void) => void;
	logPreset: (payload: PresetPayload, overrideNote?: string, onLogged?: () => void, onUndone?: () => void) => void;
};

type TaskActionsProviderProps = {
	householdId: string;
	presets: PresetSummary[];
	currentUserId: string;
	currentUserRole: "DICTATOR" | "APPROVER" | "DOER";
	children: ReactNode;
};

const TaskActionsContext = createContext<TaskActionsContextValue | null>(null);

export const TaskActionsProvider = ({
	householdId,
	presets,
	currentUserId,
	currentUserRole,
	children,
}: TaskActionsProviderProps) => {
	const defaultBucket = DEFAULT_DURATION_BUCKET;
	const [note, setNote] = useState("");
	const [customPresets, setCustomPresets] = useState(presets);
	const [isPresetPending, startPresetTransition] = useTransition();

	const router = useRouter();
	const { toast } = useToast();
	const { t } = useTranslation();
	const utils = trpc.useUtils();
	const onUndoneRef = useRef<(() => void) | undefined>(undefined);

	const revertLogMutation = trpc.logs.updateStatus.useMutation({
		onSuccess: () => {
			toast({ title: t("Entry reverted"), description: t("The points from this entry were removed.") });
			utils.logs.invalidate();
			router.refresh();
		},
		onError: (error) => {
			toast({
				title: t("Unable to undo"),
				description: error.message ?? t("Try again shortly."),
				variant: "destructive",
			});
			router.refresh();
		},
	});

	const createLogMutation = trpc.logs.create.useMutation({
		onSuccess: (data) => {
			const isPending = data.entry.status === "PENDING";
			// The toast stays clickable during its exit animation; send one revert per tap.
			let undoRequested = false;
			const onUndone = onUndoneRef.current;
			setNote("");
			toast({
				title: data.countedTowards
					? data.countedTowards.assigneeName
						? t("Counted towards {{name}}'s {{task}}", {
								name: data.countedTowards.assigneeName,
								task: data.countedTowards.label,
							})
						: t("Counted towards {{task}}", { task: data.countedTowards.label })
					: isPending
						? t("Submitted for approval")
						: t("Task logged"),
				description: data.countedTowards
					? isPending
						? t("Completion logged and waiting on approval.")
						: t("Completion logged and points added.")
					: isPending
						? t("Task logged and waiting for approval.")
						: t("Task recorded and points added."),
				variant: isPending ? "warning" : "success",
				duration: 8000,
				action: (
					<ToastAction
						altText={t("Undo from History")}
						onClick={() => {
							if (undoRequested) return;
							undoRequested = true;
							revertLogMutation.mutate({ id: data.entry.id, action: "revert" }, { onSuccess: () => onUndone?.() });
						}}
					>
						{t("Undo")}
					</ToastAction>
				),
			});
			utils.logs.invalidate();
			router.refresh();
		},
		onError: (error) => {
			if (error.data?.code === "BAD_REQUEST") {
				router.refresh();
			}
			toast({
				title: t("Unable to log task"),
				description: error.message ?? t("Please try again."),
				variant: "destructive",
			});
		},
	});

	useEffect(() => {
		setCustomPresets(presets);
	}, [presets]);

	const presetTemplates: PresetTemplate[] = PRESET_TASKS;

	const presetOptions: PresetOption[] = customPresets.map((task) => ({
		id: task.id,
		label: task.label,
		bucket: task.bucket,
		templateKey: task.templateKey,
		iconKey: task.iconKey,
		isShared: task.isShared,
		sortOrder: task.sortOrder,
	}));

	// onLogged fires only once a log is written, never for an error; onUndone after its toast Undo succeeds.
	const logPreset = (payload: PresetPayload, overrideNote?: string, onLogged?: () => void, onUndone?: () => void) => {
		const noteValue = overrideNote ?? note.trim();
		// Logging is disabled while a log is pending, so one callback is in flight at a time.
		onUndoneRef.current = onUndone;
		createLogMutation.mutate(
			{
				householdId,
				type: "preset" as const,
				...payload,
				description: noteValue || undefined,
			},
			{
				onSuccess: () => {
					onLogged?.();
				},
			},
		);
	};

	const disabled = createLogMutation.isPending || isPresetPending;

	return (
		<TaskActionsContext.Provider
			value={{
				householdId,
				presetOptions,
				presetTemplates,
				customPresets,
				setCustomPresets,
				currentUserId,
				currentUserRole,
				note,
				setNote,
				defaultBucket,
				disabled,
				isPending: createLogMutation.isPending,
				isPresetPending,
				startTransition: startPresetTransition,
				startPresetTransition,
				logPreset,
			}}
		>
			{children}
		</TaskActionsContext.Provider>
	);
};

export const useTaskActions = () => {
	const context = useContext(TaskActionsContext);
	if (!context) {
		throw new Error("useTaskActions must be used within TaskActionsProvider");
	}
	return context;
};
