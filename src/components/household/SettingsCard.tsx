"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";

import { Button } from "@/components/ui/Button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/Card";
import { Input } from "@/components/ui/Input";
import { Label } from "@/components/ui/Label";
import { Switch } from "@/components/ui/Switch";
import { useToast } from "@/hooks/useToast";
import { trpc } from "@/lib/trpc/react";

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
	const { toast } = useToast();
	const router = useRouter();
	const isSection = variant === "section";

	const { data, isLoading, error } = trpc.households.getCurrent.useQuery(undefined, {
		enabled: canManage,
	});

	const utils = trpc.useUtils();

	const updateMutation = trpc.households.updateCurrent.useMutation({
		onSuccess: (result) => {
			const updatedName = result.household.name;
			const updatedThreshold = result.household.rewardThreshold;
			const updatedProgressBarColor = result.household.progressBarColor;

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
			utils.households.getCurrent.invalidate();
			router.refresh();
		},
		onError: (error) => {
			toast({
				title: "Unable to update household",
				description: error.message ?? "Please try again.",
				variant: "destructive",
			});
		},
	});

	useEffect(() => {
		if (data?.household) {
			const fetchedName = data.household.name;
			const fetchedThreshold = data.household.rewardThreshold;
			const fetchedProgressBarColor =
				data.household.progressBarColor && isValidProgressBarColor(data.household.progressBarColor)
					? data.household.progressBarColor
					: null;

			setName(fetchedName);
			setInitialName(fetchedName);
			setThreshold(String(fetchedThreshold));
			setInitialThreshold(fetchedThreshold);
			setProgressBarColor(fetchedProgressBarColor ?? DEFAULT_PROGRESS_BAR_COLOR);
			setInitialProgressBarColor(fetchedProgressBarColor);
			setUseCustomProgressBarColor(Boolean(fetchedProgressBarColor));
		}
	}, [data]);

	useEffect(() => {
		if (error) {
			toast({
				title: "Unable to load household settings",
				description: "Please refresh and try again.",
				variant: "destructive",
			});
		}
	}, [error, toast]);

	if (!canManage) {
		return null;
	}

	const isPending = updateMutation.isPending;
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

		updateMutation.mutate({
			name: name.trim(),
			rewardThreshold: Math.floor(parsedThreshold),
			progressBarColor: currentProgressBarColor,
		});
	};

	const header = (
		<div className={isSection ? "space-y-1" : undefined}>
			<CardTitle className={isSection ? "text-base" : "text-xl"}>General</CardTitle>
			<CardDescription>Update your household basics and dashboard progress theme.</CardDescription>
		</div>
	);

	const content = (
		<div className="space-y-6">
			<div className="space-y-4">
				<div className="grid gap-4 sm:grid-cols-2">
					<div className="space-y-2">
						<Label htmlFor="household-name">Household name</Label>
						<Input
							id="household-name"
							value={name}
							onChange={(event) => setName(event.target.value)}
							disabled={isLoading || isPending}
							placeholder="Enter household name"
						/>
						<p className="text-xs text-muted-foreground">Minimum 2 characters</p>
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
						<p className="text-xs text-muted-foreground">Points needed to claim a reward</p>
					</div>
				</div>

				<div className="space-y-2">
					<div className="flex items-center gap-3">
						<Label htmlFor="household-progress-color-enabled">Custom progress color</Label>
						<Switch
							id="household-progress-color-enabled"
							checked={useCustomProgressBarColor}
							onCheckedChange={setUseCustomProgressBarColor}
							disabled={isLoading || isPending}
						/>
						{useCustomProgressBarColor && (
							<Input
								id="household-progress-color"
								type="color"
								value={progressBarColor}
								onChange={(event) => setProgressBarColor(event.target.value)}
								disabled={isLoading || isPending}
								className="h-9 w-20 cursor-pointer p-1"
							/>
						)}
					</div>
					<p className="text-xs text-muted-foreground">Customize the dashboard progress bar color</p>
				</div>
			</div>

			<div className="space-y-2">
				<Button
					type="button"
					onClick={handleSave}
					disabled={isLoading || isPending || !canSave || !isFormDirty}
					className="w-full"
				>
					{isPending ? "Saving..." : "Save changes"}
				</Button>
				{isFormDirty && canSave && (
					<p className="text-xs text-center text-muted-foreground">You have unsaved changes</p>
				)}
			</div>
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
