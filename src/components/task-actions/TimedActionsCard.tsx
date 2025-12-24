"use client";

import { Loader2Icon, SparklesIcon } from "lucide-react";
import { useRouter } from "next/navigation";
import type { FormEvent } from "react";
import { useState } from "react";

import { useTaskActions } from "@/components/task-actions/Context";
import { normalizeText } from "@/components/task-actions/utils";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import {
	Card,
	CardContent,
	CardDescription,
	CardHeader,
	CardTitle,
} from "@/components/ui/Card";
import { Label } from "@/components/ui/Label";
import { Textarea } from "@/components/ui/Textarea";
import { useToast } from "@/hooks/use-toast";
import { DURATION_BUCKETS } from "@/lib/points";
import { cn } from "@/lib/utils";

export const TimedActionsCard = () => {
	const {
		presetOptions,
		disabled,
		defaultBucket,
		isPending,
		startTransition,
		logPreset,
	} = useTaskActions();
	const [selectedBucket, setSelectedBucket] = useState(defaultBucket);
	const [description, setDescription] = useState("");
	const [durationMinutes, setDurationMinutes] = useState("");

	const router = useRouter();
	const { toast } = useToast();

	const descriptionQuery = normalizeText(description);
	const shouldSearchDescription = descriptionQuery.length >= 2;
	const descriptionMatches = shouldSearchDescription
		? presetOptions.filter((preset) =>
				normalizeText(preset.label).includes(descriptionQuery),
			)
		: [];

	const handleTimed = (event: FormEvent<HTMLFormElement>) => {
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
							<div className="flex items-center justify-between">
								<Label htmlFor="description">What was the task?</Label>
								<Button
									type="button"
									variant="ghost"
									size="sm"
									onClick={() => setDescription("")}
									disabled={disabled || description.trim().length === 0}
								>
									Clear
								</Button>
							</div>
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
							{descriptionMatches.length > 0 ? (
								<div className="rounded-md border bg-muted/40 p-2 text-xs">
									<p className="text-muted-foreground">
										This looks like an existing preset. Log it instead:
									</p>
									<div className="mt-2 flex flex-wrap gap-2">
										{descriptionMatches.slice(0, 6).map((preset) => {
											const bucket = DURATION_BUCKETS.find(
												(item) => item.key === preset.bucket,
											);
											return (
												<Button
													key={`preset-desc-${preset.id}`}
													type="button"
													variant="secondary"
													size="sm"
													onClick={() => {
														logPreset(
															preset.kind === "builtin"
																? { presetKey: preset.id }
																: { presetId: preset.id },
															description.trim() || undefined,
														);
														setDescription("");
														setDurationMinutes("");
													}}
													disabled={disabled}
												>
													{preset.label} · {bucket?.points ?? 0} pts
												</Button>
											);
										})}
									</div>
								</div>
							) : null}
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
						Log {DURATION_BUCKETS.find((b) => b.key === selectedBucket)?.points}{" "}
						pts
					</Button>
				</form>
			</CardContent>
		</Card>
	);
};
