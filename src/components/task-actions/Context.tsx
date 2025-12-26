"use client";

import { useRouter } from "next/navigation";
import type { ReactNode } from "react";
import {
	createContext,
	useContext,
	useEffect,
	useState,
	useTransition,
} from "react";

import type {
	PresetOption,
	PresetSummary,
	PresetTemplate,
} from "@/components/task-actions/types";
import { useToast } from "@/hooks/use-toast";
import { DURATION_BUCKETS, type DurationKey, PRESET_TASKS } from "@/lib/points";

type TaskActionsContextValue = {
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
	logPreset: (
		payload: { presetKey?: string; presetId?: string },
		overrideNote?: string,
	) => void;
};

type TaskActionsProviderProps = {
	presets: PresetSummary[];
	currentUserId: string;
	currentUserRole: "DICTATOR" | "APPROVER" | "DOER";
	children: ReactNode;
};

const TaskActionsContext = createContext<TaskActionsContextValue | null>(null);

export const TaskActionsProvider = ({
	presets,
	currentUserId,
	currentUserRole,
	children,
}: TaskActionsProviderProps) => {
	const defaultBucket =
		DURATION_BUCKETS.find((bucket) => bucket.key === "QUICK")?.key ??
		DURATION_BUCKETS[0].key;
	const [note, setNote] = useState("");
	const [customPresets, setCustomPresets] = useState(presets);
	const [isPending, startTransition] = useTransition();
	const [isPresetPending, startPresetTransition] = useTransition();

	const router = useRouter();
	const { toast } = useToast();

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

	const logPreset = (
		payload: { presetKey?: string; presetId?: string },
		overrideNote?: string,
	) => {
		startTransition(async () => {
			const noteValue = overrideNote ?? note.trim();
			const res = await fetch("/api/logs", {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({
					type: "preset",
					...payload,
					description: noteValue || undefined,
				}),
			});

			if (!res.ok) {
				const body = await res.json().catch(() => ({}));
				toast({
					title: "Unable to log task",
					description: body?.error ?? "Please try again.",
					variant: "destructive",
				});
				return;
			}

			const body = await res.json().catch(() => ({}));
			const isPending = body?.entry?.status === "PENDING";
			setNote("");
			toast({
				title: isPending ? "Submitted for approval" : "Task logged",
				description: isPending
					? "Task logged and waiting for approval."
					: "Preset task recorded and points added.",
			});
			router.refresh();
		});
	};

	const disabled = isPending || isPresetPending;

	return (
		<TaskActionsContext.Provider
			value={{
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
				isPending,
				isPresetPending,
				startTransition,
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
