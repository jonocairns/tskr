"use client";

import { useRouter } from "next/navigation";
import type { ReactNode } from "react";
import { createContext, useContext, useEffect, useState, useTransition } from "react";

import type { PresetOption, PresetSummary, PresetTemplate } from "@/components/task-actions/types";
import { useToast } from "@/hooks/useToast";
import { DURATION_BUCKETS, type DurationKey, PRESET_TASKS } from "@/lib/points";
import { trpc } from "@/lib/trpc/react";

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
	logPreset: (payload: { presetKey?: string; presetId?: string }, overrideNote?: string) => void;
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
	const defaultBucket = DURATION_BUCKETS.find((bucket) => bucket.key === "QUICK")?.key ?? DURATION_BUCKETS[0].key;
	const [note, setNote] = useState("");
	const [customPresets, setCustomPresets] = useState(presets);
	const [isPresetPending, startPresetTransition] = useTransition();

	const router = useRouter();
	const { toast } = useToast();
	const utils = trpc.useUtils();

	const createLogMutation = trpc.logs.create.useMutation({
		onSuccess: (data) => {
			const isPending = data.entry.status === "PENDING";
			setNote("");
			toast({
				title: isPending ? "Submitted for approval" : "Task logged",
				description: isPending ? "Task logged and waiting for approval." : "Task recorded and points added.",
			});
			utils.logs.invalidate();
			router.refresh();
		},
		onError: (error) => {
			toast({
				title: "Unable to log task",
				description: error.message ?? "Please try again.",
				variant: "destructive",
			});
		},
	});

	useEffect(() => {
		setCustomPresets(presets);
	}, [presets]);

	const presetTemplates: PresetTemplate[] = PRESET_TASKS.map((task) => ({
		key: task.key,
		label: task.label,
		bucket: task.bucket,
	}));

	const presetOptions: PresetOption[] = customPresets.map((task) => ({
		id: task.id,
		label: task.label,
		bucket: task.bucket,
		isShared: task.isShared,
	}));

	const logPreset = (payload: { presetKey?: string; presetId?: string }, overrideNote?: string) => {
		const noteValue = overrideNote ?? note.trim();
		createLogMutation.mutate({
			householdId,
			type: "preset" as const,
			...payload,
			description: noteValue || undefined,
		});
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
