"use client";

import { CheckIcon, ChevronsUpDownIcon } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";

import { Button } from "@/components/ui/Button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/Card";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/Command";
import { Input } from "@/components/ui/Input";
import { Label } from "@/components/ui/Label";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/Popover";
import { Switch } from "@/components/ui/Switch";
import { useToast } from "@/hooks/useToast";
import { DEFAULT_TIME_ZONE } from "@/lib/timeZones";
import { trpc } from "@/lib/trpc/react";
import { cn } from "@/lib/utils";

type Props = {
	householdId: string;
	canManage: boolean;
	variant?: "card" | "section";
};

const DEFAULT_PROGRESS_BAR_COLOR = "#FFFFFF";
const PROGRESS_BAR_COLOR_RE = /^#([0-9a-fA-F]{6})$/;

const isValidProgressBarColor = (value: string) => PROGRESS_BAR_COLOR_RE.test(value);

export const SettingsCard = ({ householdId, canManage, variant = "card" }: Props) => {
	const [name, setName] = useState("");
	const [initialName, setInitialName] = useState("");
	const [threshold, setThreshold] = useState("50");
	const [initialThreshold, setInitialThreshold] = useState(50);
	const [timeZone, setTimeZone] = useState(DEFAULT_TIME_ZONE);
	const [initialTimeZone, setInitialTimeZone] = useState(DEFAULT_TIME_ZONE);
	const [progressBarColor, setProgressBarColor] = useState(DEFAULT_PROGRESS_BAR_COLOR);
	const [initialProgressBarColor, setInitialProgressBarColor] = useState<string | null>(null);
	const [useCustomProgressBarColor, setUseCustomProgressBarColor] = useState(false);
	const [isTimeZoneOpen, setIsTimeZoneOpen] = useState(false);
	const { toast } = useToast();
	const router = useRouter();
	const isSection = variant === "section";

	const { data, isLoading, error } = trpc.households.getCurrent.useQuery(
		{ householdId },
		{
			enabled: canManage,
		},
	);
	const baseTimeZoneOptions = useMemo(() => data?.timeZones ?? [], [data?.timeZones]);
	const timeZoneOptions = useMemo(() => {
		if (timeZone && !baseTimeZoneOptions.includes(timeZone)) {
			return [timeZone, ...baseTimeZoneOptions];
		}
		return baseTimeZoneOptions;
	}, [baseTimeZoneOptions, timeZone]);

	const utils = trpc.useUtils();

	const { mutate: updateHousehold, isPending } = trpc.households.updateCurrent.useMutation({
		onSuccess: (result) => {
			const updatedName = result.household.name;
			const updatedThreshold = result.household.rewardThreshold;
			const updatedTimeZone = result.household.timeZone ?? DEFAULT_TIME_ZONE;
			const updatedProgressBarColor = result.household.progressBarColor;

			setName(updatedName);
			setInitialName(updatedName);
			setThreshold(String(updatedThreshold));
			setInitialThreshold(updatedThreshold);
			setTimeZone(updatedTimeZone);
			setInitialTimeZone(updatedTimeZone);
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
			const fetchedTimeZone = data.household.timeZone ?? DEFAULT_TIME_ZONE;
			const fetchedProgressBarColor =
				data.household.progressBarColor && isValidProgressBarColor(data.household.progressBarColor)
					? data.household.progressBarColor
					: null;

			setName(fetchedName);
			setInitialName(fetchedName);
			setThreshold(String(fetchedThreshold));
			setInitialThreshold(fetchedThreshold);
			setTimeZone(fetchedTimeZone);
			setInitialTimeZone(fetchedTimeZone);
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

	const isDirty = name.trim() !== initialName.trim();
	const parsedThreshold = Number(threshold);
	const thresholdValid = Number.isFinite(parsedThreshold) && parsedThreshold >= 1;
	const progressBarColorValid = !useCustomProgressBarColor || isValidProgressBarColor(progressBarColor);
	const currentProgressBarColor = useCustomProgressBarColor ? progressBarColor : null;
	const isProgressBarColorDirty = currentProgressBarColor !== initialProgressBarColor;
	const isTimeZoneDirty = timeZone !== initialTimeZone;
	const canSave = name.trim().length >= 2 && thresholdValid && progressBarColorValid;
	const isFormDirty =
		isDirty || Math.floor(parsedThreshold) !== initialThreshold || isProgressBarColorDirty || isTimeZoneDirty;

	const handleSave = () => {
		if (!canSave || !isFormDirty) {
			return;
		}

		updateHousehold({
			householdId,
			name: name.trim(),
			rewardThreshold: Math.floor(parsedThreshold),
			timeZone: isTimeZoneDirty ? timeZone.trim() : undefined,
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

				<div className="space-y-2">
					<Label htmlFor="household-time-zone">Household time zone</Label>
					<Popover open={isTimeZoneOpen} onOpenChange={setIsTimeZoneOpen}>
						<PopoverTrigger asChild>
							<button
								type="button"
								id="household-time-zone"
								role="combobox"
								aria-expanded={isTimeZoneOpen}
								disabled={isLoading || isPending}
								className={cn(
									"flex h-9 w-full items-center justify-between whitespace-nowrap rounded-md border border-input bg-transparent px-3 py-2 text-sm shadow-sm ring-offset-background focus:outline-none focus:ring-1 focus:ring-ring disabled:cursor-not-allowed disabled:opacity-50",
								)}
							>
								<span className="truncate">{timeZone || "Select time zone"}</span>
								<ChevronsUpDownIcon className="ml-2 h-4 w-4 shrink-0 opacity-50" />
							</button>
						</PopoverTrigger>
						<PopoverContent
							align="start"
							className="min-w-[var(--radix-popper-anchor-width)] w-[var(--radix-popper-anchor-width)] p-0"
						>
							<Command>
								<CommandInput placeholder="Search time zones..." />
								<CommandList>
									<CommandEmpty>No time zone found.</CommandEmpty>
									<CommandGroup>
										{timeZoneOptions.map((zone) => (
											<CommandItem
												key={zone}
												value={zone}
												onSelect={(value) => {
													setTimeZone(value);
													setIsTimeZoneOpen(false);
												}}
											>
												<CheckIcon className={cn("mr-2 h-4 w-4", timeZone === zone ? "opacity-100" : "opacity-0")} />
												<span className="truncate">{zone}</span>
											</CommandItem>
										))}
									</CommandGroup>
								</CommandList>
							</Command>
						</PopoverContent>
					</Popover>
					<p className="text-xs text-muted-foreground">Defines day and week boundaries for your household.</p>
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
