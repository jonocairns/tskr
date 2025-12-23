"use client";

import { Loader2Icon, SparklesIcon } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
	Card,
	CardContent,
	CardDescription,
	CardHeader,
	CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { DURATION_BUCKETS, PRESET_TASKS, type DurationKey } from "@/lib/points";
import { cn } from "@/lib/utils";

type PresetSummary = {
	id: string;
	label: string;
	bucket: DurationKey;
	isShared: boolean;
	createdById: string;
};

type TaskActionsProps = {
	presets: PresetSummary[];
};

export function TaskActions({ presets }: TaskActionsProps) {
	const [selectedBucket, setSelectedBucket] = useState(
		DURATION_BUCKETS.find((bucket) => bucket.key === "QUICK")?.key ??
			DURATION_BUCKETS[0].key,
	);
	const [note, setNote] = useState("");
	const [description, setDescription] = useState("");
	const [durationMinutes, setDurationMinutes] = useState("");
	const [customPresets, setCustomPresets] = useState(presets);
	const [customLabel, setCustomLabel] = useState("");
	const [customBucket, setCustomBucket] = useState<DurationKey>(
		DURATION_BUCKETS.find((bucket) => bucket.key === "QUICK")?.key ??
			DURATION_BUCKETS[0].key,
	);
	const [customShared, setCustomShared] = useState(false);
	const [isPending, startTransition] = useTransition();
	const [isPresetPending, startPresetTransition] = useTransition();

	const router = useRouter();
	const { toast } = useToast();

	const disabled = isPending || isPresetPending;
	const canCreatePreset = customLabel.trim().length >= 2;

	const logPreset = (payload: { presetKey?: string; presetId?: string }) => {
		startTransition(async () => {
			const res = await fetch("/api/logs", {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({
					type: "preset",
					...payload,
					description: note.trim() || undefined,
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

			setNote("");
			toast({
				title: "Task logged",
				description: "Preset task recorded and points added.",
			});
			router.refresh();
		});
	};

	const handleCreatePreset = (event: React.FormEvent<HTMLFormElement>) => {
		event.preventDefault();
		if (!canCreatePreset) {
			return;
		}

		startPresetTransition(async () => {
			const res = await fetch("/api/presets", {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({
					label: customLabel.trim(),
					bucket: customBucket,
					isShared: customShared,
				}),
			});

			if (!res.ok) {
				const body = await res.json().catch(() => ({}));
				toast({
					title: "Unable to add preset",
					description: body?.error ?? "Please try again.",
					variant: "destructive",
				});
				return;
			}

			const body = await res.json().catch(() => ({}));
			if (body?.preset) {
				setCustomPresets((prev) => [body.preset, ...prev]);
			}
			setCustomLabel("");
			setCustomShared(false);
			toast({
				title: "Preset added",
				description: customShared
					? "Shared preset is now available to everyone."
					: "Your preset is ready to log.",
			});
		});
	};

	const presetButtons = [
		...PRESET_TASKS.map((task) => ({
			kind: "builtin" as const,
			id: task.key,
			label: task.label,
			bucket: task.bucket,
			isShared: false,
		})),
		...customPresets.map((task) => ({
			kind: "custom" as const,
			id: task.id,
			label: task.label,
			bucket: task.bucket,
			isShared: task.isShared,
		})),
	];

	const handleTimed = (event: React.FormEvent<HTMLFormElement>) => {
		event.preventDefault();
		const minutes =
			durationMinutes.trim().length > 0 ? Number(durationMinutes) : undefined;

		startTransition(async () => {
			const res = await fetch("/api/logs", {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({
					type: "timed",
					bucket: selectedBucket,
					description: description.trim(),
					durationMinutes: minutes,
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

			setDescription("");
			setDurationMinutes("");
			toast({
				title: "Task logged",
				description: "Time-based task recorded and points added.",
			});
			router.refresh();
		});
	};

	return (
		<div className="grid gap-4 lg:grid-cols-2">
			<Card>
				<CardHeader className="space-y-1">
					<CardDescription>One tap tasks</CardDescription>
					<CardTitle className="text-xl">Prebaked chores</CardTitle>
				</CardHeader>
				<CardContent className="space-y-4">
					<div className="grid gap-2 sm:grid-cols-2">
						{presetButtons.map((task) => {
							const bucket = DURATION_BUCKETS.find(
								(b) => b.key === task.bucket,
							);
							return (
								<Button
									key={task.id}
									variant="outline"
									className="flex h-auto flex-col items-start gap-1 py-3"
									onClick={() =>
										task.kind === "builtin"
											? logPreset({ presetKey: task.id })
											: logPreset({ presetId: task.id })
									}
									disabled={disabled}
								>
									<div className="flex w-full items-center justify-between gap-2">
										<span className="font-semibold">{task.label}</span>
										<div className="flex items-center gap-1">
											{task.isShared ? (
												<Badge variant="outline">Shared</Badge>
											) : null}
											<Badge variant="secondary">{bucket?.label}</Badge>
										</div>
									</div>
									<span className="text-xs text-muted-foreground">
										{bucket?.points ?? 0} pts · {bucket?.window}
									</span>
								</Button>
							);
						})}
					</div>
					<div className="space-y-2">
						<Label htmlFor="note">Note (optional)</Label>
						<Input
							id="note"
							placeholder="Add context (e.g. “extra messy today”)"
							value={note}
							onChange={(e) => setNote(e.target.value)}
							disabled={disabled}
						/>
					</div>
					<Separator />
					<form className="space-y-3" onSubmit={handleCreatePreset}>
						<div className="space-y-2">
							<Label htmlFor="preset-label">Add a custom preset</Label>
							<Input
								id="preset-label"
								placeholder="Preset name (e.g. “Laundry”)"
								value={customLabel}
								onChange={(e) => setCustomLabel(e.target.value)}
								disabled={disabled}
							/>
						</div>
						<div className="grid gap-3 sm:grid-cols-[1fr_auto]">
							<div className="space-y-2">
								<Label htmlFor="preset-bucket">Bucket</Label>
								<Select
									value={customBucket}
									onValueChange={(value) =>
										setCustomBucket(value as DurationKey)
									}
									disabled={disabled}
								>
									<SelectTrigger id="preset-bucket">
										<SelectValue placeholder="Pick a bucket" />
									</SelectTrigger>
									<SelectContent>
										{DURATION_BUCKETS.map((bucket) => (
											<SelectItem key={bucket.key} value={bucket.key}>
												{bucket.label} ({bucket.points} pts)
											</SelectItem>
										))}
									</SelectContent>
								</Select>
							</div>
							<div className="flex items-end">
								<Button
									type="submit"
									variant="secondary"
									disabled={disabled || !canCreatePreset}
								>
									{isPresetPending ? (
										<Loader2Icon className="mr-2 h-4 w-4 animate-spin" />
									) : null}
									Add preset
								</Button>
							</div>
						</div>
						<div className="flex items-center gap-2 text-sm">
							<input
								id="preset-shared"
								type="checkbox"
								className="h-4 w-4 rounded border-input"
								checked={customShared}
								onChange={(e) => setCustomShared(e.target.checked)}
								disabled={disabled}
							/>
							<Label htmlFor="preset-shared" className="font-normal">
								Share with everyone
							</Label>
						</div>
						<p className="text-xs text-muted-foreground">
							Shared presets appear for all users.
						</p>
					</form>
				</CardContent>
			</Card>

			<Card>
				<CardHeader className="space-y-1">
					<CardDescription>Time-based logging</CardDescription>
					<CardTitle className="text-xl">How long did it take?</CardTitle>
				</CardHeader>
				<CardContent>
					<form className="space-y-4" onSubmit={handleTimed}>
						<div className="grid gap-2 sm:grid-cols-2">
							{DURATION_BUCKETS.map((bucket) => (
								<button
									key={bucket.key}
									type="button"
									onClick={() => setSelectedBucket(bucket.key)}
									className={cn(
										"flex flex-col items-start rounded-lg border p-3 text-left transition hover:border-primary",
										selectedBucket === bucket.key &&
											"border-primary bg-primary/5",
									)}
									disabled={disabled}
								>
									<div className="flex w-full items-center justify-between">
										<span className="font-semibold">{bucket.label}</span>
										<Badge variant="secondary">{bucket.points} pts</Badge>
									</div>
									<span className="text-xs text-muted-foreground">
										{bucket.window}
									</span>
								</button>
							))}
						</div>

						<div className="grid gap-3">
							<div className="space-y-2">
								<Label htmlFor="description">What was the task?</Label>
								<Textarea
									id="description"
									placeholder="Briefly describe what you completed"
									minLength={2}
									maxLength={160}
									value={description}
									onChange={(e) => setDescription(e.target.value)}
									disabled={disabled}
									required
								/>
							</div>
						</div>

						<Button
							type="submit"
							size="lg"
							className="w-full sm:w-auto"
							disabled={disabled || description.trim().length === 0}
						>
							{isPending ? (
								<Loader2Icon className="mr-2 h-4 w-4 animate-spin" />
							) : (
								<SparklesIcon className="mr-2 h-4 w-4" />
							)}
							Log{" "}
							{DURATION_BUCKETS.find((b) => b.key === selectedBucket)?.points}{" "}
							pts
						</Button>
					</form>
				</CardContent>
			</Card>
		</div>
	);
}
