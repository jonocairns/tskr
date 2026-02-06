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
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/Select";
import { Switch } from "@/components/ui/Switch";
import { useToast } from "@/hooks/useToast";
import { type DateFormat, DEFAULT_DATE_FORMAT, DEFAULT_TIME_FORMAT, type TimeFormat } from "@/lib/formatDate";
import { useTranslation } from "@/lib/i18nClient";
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
	const [dateFormat, setDateFormat] = useState<DateFormat>(DEFAULT_DATE_FORMAT);
	const [initialDateFormat, setInitialDateFormat] = useState<DateFormat>(DEFAULT_DATE_FORMAT);
	const [timeFormat, setTimeFormat] = useState<TimeFormat>(DEFAULT_TIME_FORMAT);
	const [initialTimeFormat, setInitialTimeFormat] = useState<TimeFormat>(DEFAULT_TIME_FORMAT);
	const [progressBarColor, setProgressBarColor] = useState(DEFAULT_PROGRESS_BAR_COLOR);
	const [initialProgressBarColor, setInitialProgressBarColor] = useState<string | null>(null);
	const [useCustomProgressBarColor, setUseCustomProgressBarColor] = useState(false);
	const [isTimeZoneOpen, setIsTimeZoneOpen] = useState(false);
	const { toast } = useToast();
	const { t } = useTranslation();
	const router = useRouter();
	const isSection = variant === "section";
	const dateFormatOptions: Array<{ value: DateFormat; label: string }> = [
		{ value: "DMY", label: t("DD/MM/YYYY") },
		{ value: "MDY", label: t("MM/DD/YYYY") },
		{ value: "YMD", label: t("YYYY-MM-DD") },
	];
	const timeFormatOptions: Array<{ value: TimeFormat; label: string }> = [
		{ value: "H24", label: t("24-hour (13:45)") },
		{ value: "H12", label: t("12-hour (1:45 PM)") },
	];

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
			const updatedDateFormat = result.household.dateFormat ?? DEFAULT_DATE_FORMAT;
			const updatedTimeFormat = result.household.timeFormat ?? DEFAULT_TIME_FORMAT;
			const updatedProgressBarColor = result.household.progressBarColor;

			setName(updatedName);
			setInitialName(updatedName);
			setThreshold(String(updatedThreshold));
			setInitialThreshold(updatedThreshold);
			setTimeZone(updatedTimeZone);
			setInitialTimeZone(updatedTimeZone);
			setDateFormat(updatedDateFormat);
			setInitialDateFormat(updatedDateFormat);
			setTimeFormat(updatedTimeFormat);
			setInitialTimeFormat(updatedTimeFormat);
			setInitialProgressBarColor(updatedProgressBarColor);
			setUseCustomProgressBarColor(Boolean(updatedProgressBarColor));
			if (updatedProgressBarColor) {
				setProgressBarColor(updatedProgressBarColor);
			}

			toast({ title: t("Household updated") });
			utils.households.getCurrent.invalidate();
			router.refresh();
		},
		onError: (error) => {
			toast({
				title: t("Unable to update household"),
				description: error.message ?? t("Please try again."),
				variant: "destructive",
			});
		},
	});

	useEffect(() => {
		if (data?.household) {
			const fetchedName = data.household.name;
			const fetchedThreshold = data.household.rewardThreshold;
			const fetchedTimeZone = data.household.timeZone ?? DEFAULT_TIME_ZONE;
			const fetchedDateFormat = data.household.dateFormat ?? DEFAULT_DATE_FORMAT;
			const fetchedTimeFormat = data.household.timeFormat ?? DEFAULT_TIME_FORMAT;
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
			setDateFormat(fetchedDateFormat);
			setInitialDateFormat(fetchedDateFormat);
			setTimeFormat(fetchedTimeFormat);
			setInitialTimeFormat(fetchedTimeFormat);
			setProgressBarColor(fetchedProgressBarColor ?? DEFAULT_PROGRESS_BAR_COLOR);
			setInitialProgressBarColor(fetchedProgressBarColor);
			setUseCustomProgressBarColor(Boolean(fetchedProgressBarColor));
		}
	}, [data]);

	useEffect(() => {
		if (error) {
			toast({
				title: t("Unable to load household settings"),
				description: t("Please refresh and try again."),
				variant: "destructive",
			});
		}
	}, [error, toast, t]);

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
	const isDateFormatDirty = dateFormat !== initialDateFormat;
	const isTimeFormatDirty = timeFormat !== initialTimeFormat;
	const canSave = name.trim().length >= 2 && thresholdValid && progressBarColorValid;
	const isFormDirty =
		isDirty ||
		Math.floor(parsedThreshold) !== initialThreshold ||
		isProgressBarColorDirty ||
		isTimeZoneDirty ||
		isDateFormatDirty ||
		isTimeFormatDirty;

	const handleSave = () => {
		if (!canSave || !isFormDirty) {
			return;
		}

		updateHousehold({
			householdId,
			name: name.trim(),
			rewardThreshold: Math.floor(parsedThreshold),
			timeZone: isTimeZoneDirty ? timeZone.trim() : undefined,
			dateFormat: isDateFormatDirty ? dateFormat : undefined,
			timeFormat: isTimeFormatDirty ? timeFormat : undefined,
			progressBarColor: currentProgressBarColor,
		});
	};

	const header = (
		<div className={isSection ? "space-y-1" : undefined}>
			<CardTitle className={isSection ? "text-base" : "text-xl"}>{t("General")}</CardTitle>
			<CardDescription>{t("Update your household basics and dashboard progress theme.")}</CardDescription>
		</div>
	);

	const content = (
		<div className="space-y-6">
			<div className="space-y-4">
				<div className="grid gap-4 sm:grid-cols-2">
					<div className="space-y-2">
						<Label htmlFor="household-name">{t("Household name")}</Label>
						<Input
							id="household-name"
							value={name}
							onChange={(event) => setName(event.target.value)}
							disabled={isLoading || isPending}
							placeholder={t("Enter household name")}
						/>
						<p className="text-xs text-muted-foreground">{t("Minimum 2 characters")}</p>
					</div>
					<div className="space-y-2">
						<Label htmlFor="household-threshold">{t("Reward threshold")}</Label>
						<Input
							id="household-threshold"
							type="number"
							min={1}
							step={1}
							value={threshold}
							onChange={(event) => setThreshold(event.target.value)}
							disabled={isLoading || isPending}
						/>
						<p className="text-xs text-muted-foreground">{t("Points needed to claim a reward")}</p>
					</div>
				</div>

				<div className="space-y-2">
					<div className="flex items-center gap-3">
						<Label htmlFor="household-progress-color-enabled">{t("Custom progress color")}</Label>
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
					<p className="text-xs text-muted-foreground">{t("Customize the dashboard progress bar color")}</p>
				</div>

				<div className="space-y-2">
					<Label htmlFor="household-time-zone">{t("Household time zone")}</Label>
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
								<span className="truncate">{timeZone || t("Select time zone")}</span>
								<ChevronsUpDownIcon className="ml-2 h-4 w-4 shrink-0 opacity-50" />
							</button>
						</PopoverTrigger>
						<PopoverContent
							align="start"
							className="min-w-[var(--radix-popper-anchor-width)] w-[var(--radix-popper-anchor-width)] p-0"
						>
							<Command>
								<CommandInput placeholder={t("Search time zones...")} />
								<CommandList>
									<CommandEmpty>{t("No time zone found.")}</CommandEmpty>
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
					<p className="text-xs text-muted-foreground">{t("Defines day and week boundaries for your household.")}</p>
				</div>

				<div className="grid gap-4 sm:grid-cols-2">
					<div className="space-y-2">
						<Label htmlFor="household-date-format">{t("Date format")}</Label>
						<Select
							value={dateFormat}
							onValueChange={(value: DateFormat) => setDateFormat(value)}
							disabled={isLoading || isPending}
						>
							<SelectTrigger id="household-date-format">
								<SelectValue placeholder={t("Select date format")} />
							</SelectTrigger>
							<SelectContent>
								{dateFormatOptions.map((option) => (
									<SelectItem key={option.value} value={option.value}>
										{option.label}
									</SelectItem>
								))}
							</SelectContent>
						</Select>
						<p className="text-xs text-muted-foreground">{t("Applies to dates across the household.")}</p>
					</div>
					<div className="space-y-2">
						<Label htmlFor="household-time-format">{t("Time format")}</Label>
						<Select
							value={timeFormat}
							onValueChange={(value: TimeFormat) => setTimeFormat(value)}
							disabled={isLoading || isPending}
						>
							<SelectTrigger id="household-time-format">
								<SelectValue placeholder={t("Select time format")} />
							</SelectTrigger>
							<SelectContent>
								{timeFormatOptions.map((option) => (
									<SelectItem key={option.value} value={option.value}>
										{option.label}
									</SelectItem>
								))}
							</SelectContent>
						</Select>
						<p className="text-xs text-muted-foreground">{t("Applies to times across the household.")}</p>
					</div>
				</div>
			</div>

			<div className="space-y-2">
				<Button
					type="button"
					onClick={handleSave}
					disabled={isLoading || isPending || !canSave || !isFormDirty}
					className="w-full"
				>
					{isPending ? t("Saving...") : t("Save changes")}
				</Button>
				{isFormDirty && canSave && (
					<p className="text-xs text-center text-muted-foreground">{t("You have unsaved changes")}</p>
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
