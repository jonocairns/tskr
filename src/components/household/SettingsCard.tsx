"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState, useTransition } from "react";

import { Button } from "@/components/ui/Button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/Card";
import { Input } from "@/components/ui/Input";
import { Label } from "@/components/ui/Label";
import { Switch } from "@/components/ui/Switch";
import { useToast } from "@/hooks/use-toast";

type Props = {
	householdId: string;
	canManage: boolean;
	variant?: "card" | "section";
};

const DEFAULT_PROGRESS_BAR_COLOR = "#FFFFFF";
const PROGRESS_BAR_COLOR_RE = /^#([0-9a-fA-F]{6})$/;

const isValidProgressBarColor = (value: string) => PROGRESS_BAR_COLOR_RE.test(value);

export const SettingsCard = ({ canManage, variant = "card" }: Props) => {
	const [name, setName] = useState("");
	const [initialName, setInitialName] = useState("");
	const [threshold, setThreshold] = useState("50");
	const [initialThreshold, setInitialThreshold] = useState(50);
	const [progressBarColor, setProgressBarColor] = useState(DEFAULT_PROGRESS_BAR_COLOR);
	const [initialProgressBarColor, setInitialProgressBarColor] = useState<string | null>(null);
	const [useCustomProgressBarColor, setUseCustomProgressBarColor] = useState(false);
	const [isLoading, setIsLoading] = useState(true);
	const [isPending, startTransition] = useTransition();
	const { toast } = useToast();
	const router = useRouter();
	const isSection = variant === "section";

	useEffect(() => {
		if (!canManage) {
			return;
		}

		let isActive = true;

		const load = async () => {
			setIsLoading(true);
			try {
				const res = await fetch("/api/households/current");
				if (!res.ok) {
					throw new Error("Failed to load household");
				}
				const data = await res.json().catch(() => ({}));
				if (!isActive) {
					return;
				}
				const fetchedName = typeof data?.household?.name === "string" ? data.household.name : "";
				const fetchedThreshold =
					typeof data?.household?.rewardThreshold === "number" ? data.household.rewardThreshold : 50;
				const fetchedProgressBarColor =
					typeof data?.household?.progressBarColor === "string" &&
					isValidProgressBarColor(data.household.progressBarColor)
						? data.household.progressBarColor
						: null;
				setName(fetchedName);
				setInitialName(fetchedName);
				setThreshold(String(fetchedThreshold));
				setInitialThreshold(fetchedThreshold);
				setProgressBarColor(fetchedProgressBarColor ?? DEFAULT_PROGRESS_BAR_COLOR);
				setInitialProgressBarColor(fetchedProgressBarColor);
				setUseCustomProgressBarColor(Boolean(fetchedProgressBarColor));
			} catch (error) {
				if (isActive) {
					toast({
						title: "Unable to load household settings",
						description: "Please refresh and try again.",
						variant: "destructive",
					});
				}
			} finally {
				if (isActive) {
					setIsLoading(false);
				}
			}
		};

		load();

		return () => {
			isActive = false;
		};
	}, [canManage, toast]);

	if (!canManage) {
		return null;
	}

	const isDirty = name.trim() !== initialName.trim();
	const parsedThreshold = Number(threshold);
	const thresholdValid = Number.isFinite(parsedThreshold) && parsedThreshold >= 1;
	const progressBarColorValid = !useCustomProgressBarColor || isValidProgressBarColor(progressBarColor);
	const currentProgressBarColor = useCustomProgressBarColor ? progressBarColor : null;
	const isProgressBarColorDirty = currentProgressBarColor !== initialProgressBarColor;
	const canSave = name.trim().length >= 2 && thresholdValid && progressBarColorValid;
	const isFormDirty = isDirty || Math.floor(parsedThreshold) !== initialThreshold || isProgressBarColorDirty;

	const handleSave = () => {
		if (!canSave || !isFormDirty) {
			return;
		}

		startTransition(async () => {
			const res = await fetch("/api/households/current", {
				method: "PATCH",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({
					name: name.trim(),
					rewardThreshold: Math.floor(parsedThreshold),
					progressBarColor: currentProgressBarColor,
				}),
			});

			if (!res.ok) {
				const body = await res.json().catch(() => ({}));
				toast({
					title: "Unable to update household",
					description: body?.error ?? "Please try again.",
					variant: "destructive",
				});
				return;
			}

			const body = await res.json().catch(() => ({}));
			const updatedName = typeof body?.household?.name === "string" ? body.household.name : name.trim();
			const updatedThreshold =
				typeof body?.household?.rewardThreshold === "number"
					? body.household.rewardThreshold
					: Math.floor(parsedThreshold);
			const updatedProgressBarColor =
				typeof body?.household?.progressBarColor === "string" &&
				isValidProgressBarColor(body.household.progressBarColor)
					? body.household.progressBarColor
					: null;
			setName(updatedName);
			setInitialName(updatedName);
			setThreshold(String(updatedThreshold));
			setInitialThreshold(updatedThreshold);
			setInitialProgressBarColor(updatedProgressBarColor);
			setUseCustomProgressBarColor(Boolean(updatedProgressBarColor));
			if (updatedProgressBarColor) {
				setProgressBarColor(updatedProgressBarColor);
			}
			toast({ title: "Household updated" });
			router.refresh();
		});
	};

	const header = (
		<div className={isSection ? "space-y-1" : undefined}>
			<CardTitle className={isSection ? "text-base" : "text-xl"}>General</CardTitle>
			<CardDescription>Update your household basics and dashboard progress theme.</CardDescription>
		</div>
	);

	const content = (
		<div className="space-y-4">
			<div className="grid gap-4 sm:grid-cols-2">
				<div className="space-y-2">
					<Label htmlFor="household-name">Name</Label>
					<Input
						id="household-name"
						value={name}
						onChange={(event) => setName(event.target.value)}
						disabled={isLoading || isPending}
					/>
				</div>
				<div className="space-y-2">
					<Label htmlFor="household-threshold">Reward threshold</Label>
					<Input
						id="household-threshold"
						type="number"
						min={1}
						step={1}
						value={threshold}
						onChange={(event) => setThreshold(event.target.value)}
						disabled={isLoading || isPending}
					/>
				</div>
			</div>
			<div className="space-y-2">
				<div className="flex flex-wrap items-center justify-between gap-3">
					<Label htmlFor="household-progress-color">Progress bar color</Label>
					<div className="flex items-center gap-2">
						<Switch
							id="household-progress-color-enabled"
							checked={useCustomProgressBarColor}
							onCheckedChange={setUseCustomProgressBarColor}
							disabled={isLoading || isPending}
						/>
						<Label htmlFor="household-progress-color-enabled" className="text-sm font-normal">
							Custom color
						</Label>
					</div>
				</div>
				<div className="flex items-center gap-3">
					<Input
						id="household-progress-color"
						type="color"
						value={progressBarColor}
						onChange={(event) => setProgressBarColor(event.target.value)}
						disabled={isLoading || isPending || !useCustomProgressBarColor}
						className="h-10 w-16 p-2"
					/>
					<p className="text-sm text-muted-foreground">Theme the overview progress bar.</p>
				</div>
			</div>
			<Button type="button" onClick={handleSave} disabled={isLoading || isPending || !canSave || !isFormDirty}>
				Save changes
			</Button>
		</div>
	);

	if (isSection) {
		return <section className="space-y-3">{content}</section>;
	}

	return (
		<Card>
			<CardHeader>{header}</CardHeader>
			<CardContent>{content}</CardContent>
		</Card>
	);
};
