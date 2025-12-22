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
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { DURATION_BUCKETS, PRESET_TASKS } from "@/lib/points";
import { cn } from "@/lib/utils";

export function TaskActions() {
	const [selectedBucket, setSelectedBucket] = useState(
		DURATION_BUCKETS.find((bucket) => bucket.key === "QUICK")?.key ??
			DURATION_BUCKETS[0].key,
	);
	const [note, setNote] = useState("");
	const [description, setDescription] = useState("");
	const [durationMinutes, setDurationMinutes] = useState("");
	const [isPending, startTransition] = useTransition();

	const router = useRouter();
	const { toast } = useToast();

	const disabled = isPending;

	const handlePreset = (presetKey: string) => {
		startTransition(async () => {
			const res = await fetch("/api/logs", {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({
					type: "preset",
					presetKey,
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
						{PRESET_TASKS.map((task) => {
							const bucket = DURATION_BUCKETS.find(
								(b) => b.key === task.bucket,
							);
							return (
								<Button
									key={task.key}
									variant="outline"
									className="flex h-auto flex-col items-start gap-1 py-3"
									onClick={() => handlePreset(task.key)}
									disabled={disabled}
								>
									<div className="flex w-full items-center justify-between">
										<span className="font-semibold">{task.label}</span>
										<Badge variant="secondary">{bucket?.label}</Badge>
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
