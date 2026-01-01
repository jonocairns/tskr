"use client";

import { useEffect, useState } from "react";

import { Button } from "@/components/ui/Button";
import { CardDescription, CardTitle } from "@/components/ui/Card";
import { Input } from "@/components/ui/Input";
import { Label } from "@/components/ui/Label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/Select";
import { Switch } from "@/components/ui/Switch";
import { usePushNotificationStatus } from "@/contexts/PushNotificationContext";
import { useToast } from "@/hooks/useToast";
import { trpc } from "@/lib/trpc/react";

type Props = {
	householdId: string;
	userId: string;
	canManage: boolean;
	variant?: "card" | "section";
};

const DAYS_OF_WEEK = [
	{ value: 0, label: "Sunday" },
	{ value: 1, label: "Monday" },
	{ value: 2, label: "Tuesday" },
	{ value: 3, label: "Wednesday" },
	{ value: 4, label: "Thursday" },
	{ value: 5, label: "Friday" },
	{ value: 6, label: "Saturday" },
];

const utcToLocal = (utcTime: string | null): string => {
	if (!utcTime) return "18:00";
	const [hours, minutes] = utcTime.split(":").map(Number);
	const date = new Date();
	date.setUTCHours(hours, minutes, 0, 0);
	const localHours = String(date.getHours()).padStart(2, "0");
	const localMinutes = String(date.getMinutes()).padStart(2, "0");
	return `${localHours}:${localMinutes}`;
};

const localToUtc = (localTime: string): string => {
	const [hours, minutes] = localTime.split(":").map(Number);
	const date = new Date();
	date.setHours(hours, minutes, 0, 0);
	const utcHours = String(date.getUTCHours()).padStart(2, "0");
	const utcMinutes = String(date.getUTCMinutes()).padStart(2, "0");
	return `${utcHours}:${utcMinutes}`;
};

export const CombinedReminderSettings = ({ canManage, variant = "card" }: Props) => {
	const { isSubscribed } = usePushNotificationStatus();
	const { toast } = useToast();

	// Household settings state
	const [householdDailyEnabled, setHouseholdDailyEnabled] = useState(false);
	const [householdDailyTime, setHouseholdDailyTime] = useState("18:00");
	const [householdWeeklyEnabled, setHouseholdWeeklyEnabled] = useState(false);
	const [householdWeeklyDay, setHouseholdWeeklyDay] = useState(1);
	const [householdWeeklyTime, setHouseholdWeeklyTime] = useState("18:00");
	const [householdIntervalEnabled, setHouseholdIntervalEnabled] = useState(false);
	const [householdIntervalDays, setHouseholdIntervalDays] = useState(7);
	const [householdEventEnabled, setHouseholdEventEnabled] = useState(false);
	const [householdEventDays, setHouseholdEventDays] = useState(7);

	// Personal override states
	const [dailyOverride, setDailyOverride] = useState<"default" | "enabled" | "disabled">("default");
	const [dailyTime, setDailyTime] = useState("18:00");
	const [weeklyOverride, setWeeklyOverride] = useState<"default" | "enabled" | "disabled">("default");
	const [weeklyDay, setWeeklyDay] = useState(1);
	const [weeklyTime, setWeeklyTime] = useState("18:00");
	const [intervalOverride, setIntervalOverride] = useState<"default" | "enabled" | "disabled">("default");
	const [intervalDays, setIntervalDays] = useState(7);
	const [eventOverride, setEventOverride] = useState<"default" | "enabled" | "disabled">("default");
	const [eventDays, setEventDays] = useState(7);

	// Pause state
	const [isPaused, setIsPaused] = useState(false);
	const [pauseDays, setPauseDays] = useState(7);

	const [initialHouseholdValues, setInitialHouseholdValues] = useState({
		dailyEnabled: false,
		dailyTime: "18:00",
		weeklyEnabled: false,
		weeklyDay: 1,
		weeklyTime: "18:00",
		intervalEnabled: false,
		intervalDays: 7,
		eventEnabled: false,
		eventDays: 7,
	});

	const [initialPersonalValues, setInitialPersonalValues] = useState({
		dailyOverride: "default" as "default" | "enabled" | "disabled",
		dailyTime: "18:00",
		weeklyOverride: "default" as "default" | "enabled" | "disabled",
		weeklyDay: 1,
		weeklyTime: "18:00",
		intervalOverride: "default" as "default" | "enabled" | "disabled",
		intervalDays: 7,
		eventOverride: "default" as "default" | "enabled" | "disabled",
		eventDays: 7,
	});

	const { data: householdData, isLoading: isLoadingHousehold } = trpc.reminders.getHouseholdConfig.useQuery();
	const { data: overrideData, isLoading: isLoadingOverride } = trpc.reminders.getUserOverride.useQuery();
	const utils = trpc.useUtils();

	const updateHouseholdMutation = trpc.reminders.updateHouseholdConfig.useMutation({
		onSuccess: () => {
			toast({ title: "Household reminder settings updated" });
			setInitialHouseholdValues({
				dailyEnabled: householdDailyEnabled,
				dailyTime: householdDailyTime,
				weeklyEnabled: householdWeeklyEnabled,
				weeklyDay: householdWeeklyDay,
				weeklyTime: householdWeeklyTime,
				intervalEnabled: householdIntervalEnabled,
				intervalDays: householdIntervalDays,
				eventEnabled: householdEventEnabled,
				eventDays: householdEventDays,
			});
			utils.reminders.getHouseholdConfig.invalidate();
		},
		onError: (error) => {
			toast({
				title: "Failed to update household settings",
				description: error.message,
				variant: "destructive",
			});
		},
	});

	const updatePersonalMutation = trpc.reminders.updateUserOverride.useMutation({
		onSuccess: () => {
			toast({ title: "Personal reminder settings updated" });
			setInitialPersonalValues({
				dailyOverride,
				dailyTime,
				weeklyOverride,
				weeklyDay,
				weeklyTime,
				intervalOverride,
				intervalDays,
				eventOverride,
				eventDays,
			});
			utils.reminders.getUserOverride.invalidate();
		},
		onError: (error) => {
			toast({
				title: "Failed to update personal settings",
				description: error.message,
				variant: "destructive",
			});
		},
	});

	const pauseMutation = trpc.reminders.pauseAll.useMutation({
		onSuccess: ({ pausedUntil }) => {
			toast({
				title: "Reminders paused",
				description: `Reminders paused until ${pausedUntil.toLocaleDateString()}`,
			});
			utils.reminders.getUserOverride.invalidate();
		},
		onError: (error) => {
			toast({
				title: "Failed to pause reminders",
				description: error.message,
				variant: "destructive",
			});
		},
	});

	const resumeMutation = trpc.reminders.resume.useMutation({
		onSuccess: () => {
			toast({ title: "Reminders resumed" });
			utils.reminders.getUserOverride.invalidate();
		},
		onError: (error) => {
			toast({
				title: "Failed to resume reminders",
				description: error.message,
				variant: "destructive",
			});
		},
	});

	useEffect(() => {
		if (householdData?.config) {
			const localDailyTime = utcToLocal(householdData.config.dailyReminderTime);
			const localWeeklyTime = utcToLocal(householdData.config.weeklyReminderTime);

			const values = {
				dailyEnabled: householdData.config.dailyReminderEnabled,
				dailyTime: localDailyTime,
				weeklyEnabled: householdData.config.weeklyReminderEnabled,
				weeklyDay: householdData.config.weeklyReminderDay || 1,
				weeklyTime: localWeeklyTime,
				intervalEnabled: householdData.config.intervalReminderEnabled,
				intervalDays: householdData.config.intervalReminderDays || 7,
				eventEnabled: householdData.config.eventReminderEnabled,
				eventDays: householdData.config.eventReminderDays || 7,
			};

			setHouseholdDailyEnabled(values.dailyEnabled);
			setHouseholdDailyTime(values.dailyTime);
			setHouseholdWeeklyEnabled(values.weeklyEnabled);
			setHouseholdWeeklyDay(values.weeklyDay);
			setHouseholdWeeklyTime(values.weeklyTime);
			setHouseholdIntervalEnabled(values.intervalEnabled);
			setHouseholdIntervalDays(values.intervalDays);
			setHouseholdEventEnabled(values.eventEnabled);
			setHouseholdEventDays(values.eventDays);
			setInitialHouseholdValues(values);
		}
	}, [householdData]);

	useEffect(() => {
		if (overrideData?.override) {
			const override = overrideData.override;
			const now = new Date();
			const paused = override.isPaused && (!override.pausedUntil || override.pausedUntil > now);
			setIsPaused(paused);

			const dailyState: "default" | "enabled" | "disabled" =
				override.dailyReminderEnabled === null ? "default" : override.dailyReminderEnabled ? "enabled" : "disabled";
			const weeklyState: "default" | "enabled" | "disabled" =
				override.weeklyReminderEnabled === null ? "default" : override.weeklyReminderEnabled ? "enabled" : "disabled";
			const intervalState: "default" | "enabled" | "disabled" =
				override.intervalReminderEnabled === null
					? "default"
					: override.intervalReminderEnabled
						? "enabled"
						: "disabled";
			const eventState: "default" | "enabled" | "disabled" =
				override.eventReminderEnabled === null ? "default" : override.eventReminderEnabled ? "enabled" : "disabled";

			const values = {
				dailyOverride: dailyState,
				dailyTime: override.dailyReminderTime ? utcToLocal(override.dailyReminderTime) : "18:00",
				weeklyOverride: weeklyState,
				weeklyDay: override.weeklyReminderDay ?? 1,
				weeklyTime: override.weeklyReminderTime ? utcToLocal(override.weeklyReminderTime) : "18:00",
				intervalOverride: intervalState,
				intervalDays: override.intervalReminderDays ?? 7,
				eventOverride: eventState,
				eventDays: override.eventReminderDays ?? 7,
			};

			setDailyOverride(values.dailyOverride);
			setDailyTime(values.dailyTime);
			setWeeklyOverride(values.weeklyOverride);
			setWeeklyDay(values.weeklyDay);
			setWeeklyTime(values.weeklyTime);
			setIntervalOverride(values.intervalOverride);
			setIntervalDays(values.intervalDays);
			setEventOverride(values.eventOverride);
			setEventDays(values.eventDays);
			setInitialPersonalValues(values);
		}
	}, [overrideData]);

	const handlePause = () => {
		pauseMutation.mutate({ days: pauseDays });
	};

	const handleResume = () => {
		resumeMutation.mutate();
	};

	const handleSaveHousehold = () => {
		updateHouseholdMutation.mutate({
			dailyReminderEnabled: householdDailyEnabled,
			dailyReminderTime: householdDailyEnabled ? localToUtc(householdDailyTime) : null,
			weeklyReminderEnabled: householdWeeklyEnabled,
			weeklyReminderDay: householdWeeklyEnabled ? householdWeeklyDay : null,
			weeklyReminderTime: householdWeeklyEnabled ? localToUtc(householdWeeklyTime) : null,
			intervalReminderEnabled: householdIntervalEnabled,
			intervalReminderDays: householdIntervalEnabled ? householdIntervalDays : null,
			eventReminderEnabled: householdEventEnabled,
			eventReminderDays: householdEventEnabled ? householdEventDays : null,
		});
	};

	const handleSavePersonal = () => {
		updatePersonalMutation.mutate({
			dailyReminderEnabled: dailyOverride === "default" ? null : dailyOverride === "enabled",
			dailyReminderTime: dailyOverride === "enabled" ? localToUtc(dailyTime) : null,
			weeklyReminderEnabled: weeklyOverride === "default" ? null : weeklyOverride === "enabled",
			weeklyReminderDay: weeklyOverride === "enabled" ? weeklyDay : null,
			weeklyReminderTime: weeklyOverride === "enabled" ? localToUtc(weeklyTime) : null,
			intervalReminderEnabled: intervalOverride === "default" ? null : intervalOverride === "enabled",
			intervalReminderDays: intervalOverride === "enabled" ? intervalDays : null,
			eventReminderEnabled: eventOverride === "default" ? null : eventOverride === "enabled",
			eventReminderDays: eventOverride === "enabled" ? eventDays : null,
		});
	};

	const isSection = variant === "section";
	const isPending =
		pauseMutation.isPending ||
		resumeMutation.isPending ||
		updateHouseholdMutation.isPending ||
		updatePersonalMutation.isPending;
	const isLoading = isLoadingHousehold || isLoadingOverride;

	if (!isSubscribed) {
		const warningContent = (
			<div className="space-y-3">
				<p className="text-sm text-muted-foreground">
					Push notifications must be enabled above before you can manage task reminders.
				</p>
			</div>
		);

		if (isSection) {
			return (
				<section className="space-y-3">
					<div className="space-y-1">
						<CardTitle className="text-base">Task Reminders</CardTitle>
						<CardDescription>Configure when you want to receive reminders to complete tasks.</CardDescription>
					</div>
					{warningContent}
				</section>
			);
		}

		return warningContent;
	}

	const isHouseholdDirty =
		householdDailyEnabled !== initialHouseholdValues.dailyEnabled ||
		householdDailyTime !== initialHouseholdValues.dailyTime ||
		householdWeeklyEnabled !== initialHouseholdValues.weeklyEnabled ||
		householdWeeklyDay !== initialHouseholdValues.weeklyDay ||
		householdWeeklyTime !== initialHouseholdValues.weeklyTime ||
		householdIntervalEnabled !== initialHouseholdValues.intervalEnabled ||
		householdIntervalDays !== initialHouseholdValues.intervalDays ||
		householdEventEnabled !== initialHouseholdValues.eventEnabled ||
		householdEventDays !== initialHouseholdValues.eventDays;

	const isPersonalDirty =
		dailyOverride !== initialPersonalValues.dailyOverride ||
		dailyTime !== initialPersonalValues.dailyTime ||
		weeklyOverride !== initialPersonalValues.weeklyOverride ||
		weeklyDay !== initialPersonalValues.weeklyDay ||
		weeklyTime !== initialPersonalValues.weeklyTime ||
		intervalOverride !== initialPersonalValues.intervalOverride ||
		intervalDays !== initialPersonalValues.intervalDays ||
		eventOverride !== initialPersonalValues.eventOverride ||
		eventDays !== initialPersonalValues.eventDays;

	const content = (
		<div className="space-y-8">
			{/* Pause controls */}
			<div className="rounded-lg border bg-muted/30 p-4">
				<div className="flex items-center justify-between mb-3">
					<div>
						<h3 className="font-medium">Reminder Status</h3>
						<p className="text-sm text-muted-foreground mt-0.5">
							{isPaused
								? `Paused${overrideData?.override?.pausedUntil ? ` until ${overrideData.override.pausedUntil.toLocaleDateString()}` : ""}`
								: "Active"}
						</p>
					</div>
					<Button
						onClick={isPaused ? handleResume : () => {}}
						disabled={isPending || !isPaused}
						variant={isPaused ? "default" : "outline"}
						size="sm"
					>
						{isPaused ? "Resume" : "Active"}
					</Button>
				</div>

				{!isPaused && (
					<div className="pt-3 border-t">
						<div className="flex items-end gap-2">
							<div className="flex-1">
								<Label htmlFor="pause-days" className="text-xs">
									Pause all reminders
								</Label>
								<div className="flex gap-2 mt-1.5">
									<Input
										id="pause-days"
										type="number"
										min={1}
										max={90}
										value={pauseDays}
										onChange={(e) => setPauseDays(Number(e.target.value))}
										disabled={isPending}
										className="w-20"
									/>
									<span className="self-center text-sm text-muted-foreground">days</span>
								</div>
							</div>
							<Button onClick={handlePause} disabled={isPending} variant="outline" size="sm">
								Pause
							</Button>
						</div>
					</div>
				)}
			</div>

			{/* Reminder types */}
			<div className="space-y-1">
				<h3 className="font-medium text-sm">Reminder Types</h3>
				<p className="text-xs text-muted-foreground">
					{canManage
						? "Configure household defaults and your personal preferences for each reminder type"
						: "Configure your personal reminder preferences"}
				</p>
			</div>

			{/* Daily Reminder */}
			<div className="rounded-lg border p-4 space-y-4">
				<div className="flex items-start justify-between">
					<div>
						<h4 className="font-medium">Daily Reminder</h4>
						<p className="text-xs text-muted-foreground mt-0.5">Get reminded at the same time every day</p>
					</div>
				</div>

				<div className="space-y-4">
					{canManage && (
						<div className="pb-4 border-b">
							<div className="flex items-center gap-3 mb-3">
								<Switch
									id="household-daily"
									checked={householdDailyEnabled}
									onCheckedChange={setHouseholdDailyEnabled}
									disabled={isLoading || isPending}
								/>
								<Label htmlFor="household-daily" className="text-sm font-medium cursor-pointer">
									Household default
								</Label>
								<span className="text-xs text-muted-foreground">(for all members)</span>
							</div>
							{householdDailyEnabled && (
								<div className="ml-11 flex items-center gap-2">
									<Label htmlFor="household-daily-time" className="text-xs text-muted-foreground whitespace-nowrap">
										Time:
									</Label>
									<Input
										id="household-daily-time"
										type="time"
										value={householdDailyTime}
										onChange={(e) => setHouseholdDailyTime(e.target.value)}
										disabled={isLoading || isPending}
										className="w-32"
									/>
								</div>
							)}
						</div>
					)}

					<div>
						<Label htmlFor="personal-daily" className="text-sm font-medium">
							Your preference
						</Label>
						<Select value={dailyOverride} onValueChange={(v) => setDailyOverride(v as typeof dailyOverride)}>
							<SelectTrigger id="personal-daily" className="w-full mt-2">
								<SelectValue />
							</SelectTrigger>
							<SelectContent>
								<SelectItem value="default">
									{householdDailyEnabled
										? `Use household default (${householdDailyTime})`
										: "Disabled (no household default)"}
								</SelectItem>
								<SelectItem value="enabled">Enable with custom time</SelectItem>
								<SelectItem value="disabled">Disable for me</SelectItem>
							</SelectContent>
						</Select>
						{dailyOverride === "enabled" && (
							<div className="flex items-center gap-2 mt-3">
								<Label htmlFor="personal-daily-time" className="text-xs text-muted-foreground whitespace-nowrap">
									Time:
								</Label>
								<Input
									id="personal-daily-time"
									type="time"
									value={dailyTime}
									onChange={(e) => setDailyTime(e.target.value)}
									disabled={isLoading || isPending}
									className="w-32"
								/>
							</div>
						)}
					</div>
				</div>
			</div>

			{/* Weekly Reminder */}
			<div className="rounded-lg border p-4 space-y-4">
				<div className="flex items-start justify-between">
					<div>
						<h4 className="font-medium">Weekly Reminder</h4>
						<p className="text-xs text-muted-foreground mt-0.5">Get reminded on a specific day each week</p>
					</div>
				</div>

				<div className="space-y-4">
					{canManage && (
						<div className="pb-4 border-b">
							<div className="flex items-center gap-3 mb-3">
								<Switch
									id="household-weekly"
									checked={householdWeeklyEnabled}
									onCheckedChange={setHouseholdWeeklyEnabled}
									disabled={isLoading || isPending}
								/>
								<Label htmlFor="household-weekly" className="text-sm font-medium cursor-pointer">
									Household default
								</Label>
								<span className="text-xs text-muted-foreground">(for all members)</span>
							</div>
							{householdWeeklyEnabled && (
								<div className="ml-11 flex flex-wrap items-center gap-3">
									<div className="flex items-center gap-2">
										<Label htmlFor="household-weekly-day" className="text-xs text-muted-foreground whitespace-nowrap">
											Day:
										</Label>
										<Select value={String(householdWeeklyDay)} onValueChange={(v) => setHouseholdWeeklyDay(Number(v))}>
											<SelectTrigger id="household-weekly-day" className="w-32">
												<SelectValue />
											</SelectTrigger>
											<SelectContent>
												{DAYS_OF_WEEK.map((day) => (
													<SelectItem key={day.value} value={String(day.value)}>
														{day.label}
													</SelectItem>
												))}
											</SelectContent>
										</Select>
									</div>
									<div className="flex items-center gap-2">
										<Label htmlFor="household-weekly-time" className="text-xs text-muted-foreground whitespace-nowrap">
											Time:
										</Label>
										<Input
											id="household-weekly-time"
											type="time"
											value={householdWeeklyTime}
											onChange={(e) => setHouseholdWeeklyTime(e.target.value)}
											disabled={isLoading || isPending}
											className="w-32"
										/>
									</div>
								</div>
							)}
						</div>
					)}

					<div>
						<Label htmlFor="personal-weekly" className="text-sm font-medium">
							Your preference
						</Label>
						<Select value={weeklyOverride} onValueChange={(v) => setWeeklyOverride(v as typeof weeklyOverride)}>
							<SelectTrigger id="personal-weekly" className="w-full mt-2">
								<SelectValue />
							</SelectTrigger>
							<SelectContent>
								<SelectItem value="default">
									{householdWeeklyEnabled
										? `Use household default (${DAYS_OF_WEEK[householdWeeklyDay].label} at ${householdWeeklyTime})`
										: "Disabled (no household default)"}
								</SelectItem>
								<SelectItem value="enabled">Enable with custom schedule</SelectItem>
								<SelectItem value="disabled">Disable for me</SelectItem>
							</SelectContent>
						</Select>
						{weeklyOverride === "enabled" && (
							<div className="flex flex-wrap items-center gap-3 mt-3">
								<div className="flex items-center gap-2">
									<Label htmlFor="personal-weekly-day" className="text-xs text-muted-foreground whitespace-nowrap">
										Day:
									</Label>
									<Select value={String(weeklyDay)} onValueChange={(v) => setWeeklyDay(Number(v))}>
										<SelectTrigger id="personal-weekly-day" className="w-32">
											<SelectValue />
										</SelectTrigger>
										<SelectContent>
											{DAYS_OF_WEEK.map((day) => (
												<SelectItem key={day.value} value={String(day.value)}>
													{day.label}
												</SelectItem>
											))}
										</SelectContent>
									</Select>
								</div>
								<div className="flex items-center gap-2">
									<Label htmlFor="personal-weekly-time" className="text-xs text-muted-foreground whitespace-nowrap">
										Time:
									</Label>
									<Input
										id="personal-weekly-time"
										type="time"
										value={weeklyTime}
										onChange={(e) => setWeeklyTime(e.target.value)}
										disabled={isLoading || isPending}
										className="w-32"
									/>
								</div>
							</div>
						)}
					</div>
				</div>
			</div>

			{/* Interval Reminder */}
			<div className="rounded-lg border p-4 space-y-4">
				<div className="flex items-start justify-between">
					<div>
						<h4 className="font-medium">Interval Reminder</h4>
						<p className="text-xs text-muted-foreground mt-0.5">Get reminded every N days</p>
					</div>
				</div>

				<div className="space-y-4">
					{canManage && (
						<div className="pb-4 border-b">
							<div className="flex items-center gap-3 mb-3">
								<Switch
									id="household-interval"
									checked={householdIntervalEnabled}
									onCheckedChange={setHouseholdIntervalEnabled}
									disabled={isLoading || isPending}
								/>
								<Label htmlFor="household-interval" className="text-sm font-medium cursor-pointer">
									Household default
								</Label>
								<span className="text-xs text-muted-foreground">(for all members)</span>
							</div>
							{householdIntervalEnabled && (
								<div className="ml-11 flex items-center gap-2">
									<Label htmlFor="household-interval-days" className="text-xs text-muted-foreground whitespace-nowrap">
										Every:
									</Label>
									<Input
										id="household-interval-days"
										type="number"
										min={1}
										max={90}
										value={householdIntervalDays}
										onChange={(e) => setHouseholdIntervalDays(Number(e.target.value))}
										disabled={isLoading || isPending}
										className="w-20"
									/>
									<span className="text-xs text-muted-foreground">days</span>
								</div>
							)}
						</div>
					)}

					<div>
						<Label htmlFor="personal-interval" className="text-sm font-medium">
							Your preference
						</Label>
						<Select value={intervalOverride} onValueChange={(v) => setIntervalOverride(v as typeof intervalOverride)}>
							<SelectTrigger id="personal-interval" className="w-full mt-2">
								<SelectValue />
							</SelectTrigger>
							<SelectContent>
								<SelectItem value="default">
									{householdIntervalEnabled
										? `Use household default (every ${householdIntervalDays} days)`
										: "Disabled (no household default)"}
								</SelectItem>
								<SelectItem value="enabled">Enable with custom interval</SelectItem>
								<SelectItem value="disabled">Disable for me</SelectItem>
							</SelectContent>
						</Select>
						{intervalOverride === "enabled" && (
							<div className="flex items-center gap-2 mt-3">
								<Label htmlFor="personal-interval-days" className="text-xs text-muted-foreground whitespace-nowrap">
									Every:
								</Label>
								<Input
									id="personal-interval-days"
									type="number"
									min={1}
									max={90}
									value={intervalDays}
									onChange={(e) => setIntervalDays(Number(e.target.value))}
									disabled={isLoading || isPending}
									className="w-20"
								/>
								<span className="text-xs text-muted-foreground">days</span>
							</div>
						)}
					</div>
				</div>
			</div>

			{/* Event-Based Reminder */}
			<div className="rounded-lg border p-4 space-y-4">
				<div className="flex items-start justify-between">
					<div>
						<h4 className="font-medium">Event-Based Reminder</h4>
						<p className="text-xs text-muted-foreground mt-0.5">Get reminded if no tasks completed recently</p>
					</div>
				</div>

				<div className="space-y-4">
					{canManage && (
						<div className="pb-4 border-b">
							<div className="flex items-center gap-3 mb-3">
								<Switch
									id="household-event"
									checked={householdEventEnabled}
									onCheckedChange={setHouseholdEventEnabled}
									disabled={isLoading || isPending}
								/>
								<Label htmlFor="household-event" className="text-sm font-medium cursor-pointer">
									Household default
								</Label>
								<span className="text-xs text-muted-foreground">(for all members)</span>
							</div>
							{householdEventEnabled && (
								<div className="ml-11 flex items-center gap-2">
									<Label htmlFor="household-event-days" className="text-xs text-muted-foreground whitespace-nowrap">
										If no tasks in:
									</Label>
									<Input
										id="household-event-days"
										type="number"
										min={1}
										max={90}
										value={householdEventDays}
										onChange={(e) => setHouseholdEventDays(Number(e.target.value))}
										disabled={isLoading || isPending}
										className="w-20"
									/>
									<span className="text-xs text-muted-foreground">days</span>
								</div>
							)}
						</div>
					)}

					<div>
						<Label htmlFor="personal-event" className="text-sm font-medium">
							Your preference
						</Label>
						<Select value={eventOverride} onValueChange={(v) => setEventOverride(v as typeof eventOverride)}>
							<SelectTrigger id="personal-event" className="w-full mt-2">
								<SelectValue />
							</SelectTrigger>
							<SelectContent>
								<SelectItem value="default">
									{householdEventEnabled
										? `Use household default (if no tasks in ${householdEventDays} days)`
										: "Disabled (no household default)"}
								</SelectItem>
								<SelectItem value="enabled">Enable with custom threshold</SelectItem>
								<SelectItem value="disabled">Disable for me</SelectItem>
							</SelectContent>
						</Select>
						{eventOverride === "enabled" && (
							<div className="flex items-center gap-2 mt-3">
								<Label htmlFor="personal-event-days" className="text-xs text-muted-foreground whitespace-nowrap">
									If no tasks in:
								</Label>
								<Input
									id="personal-event-days"
									type="number"
									min={1}
									max={90}
									value={eventDays}
									onChange={(e) => setEventDays(Number(e.target.value))}
									disabled={isLoading || isPending}
									className="w-20"
								/>
								<span className="text-xs text-muted-foreground">days</span>
							</div>
						)}
					</div>
				</div>
			</div>

			{/* Save buttons */}
			<div className="flex gap-3 pt-2">
				{canManage && (
					<Button
						onClick={handleSaveHousehold}
						disabled={isLoading || isPending || !isHouseholdDirty}
						className="flex-1"
						variant={isHouseholdDirty ? "default" : "outline"}
					>
						{updateHouseholdMutation.isPending
							? "Saving..."
							: isHouseholdDirty
								? "Save Household Defaults"
								: "No Changes"}
					</Button>
				)}
				<Button
					onClick={handleSavePersonal}
					disabled={isLoading || isPending || !isPersonalDirty}
					className="flex-1"
					variant={isPersonalDirty ? "default" : "outline"}
				>
					{updatePersonalMutation.isPending ? "Saving..." : isPersonalDirty ? "Save Personal Settings" : "No Changes"}
				</Button>
			</div>
		</div>
	);

	if (isSection) {
		return (
			<section className="space-y-3">
				<div className="space-y-1">
					<CardTitle className="text-base">Task Reminders</CardTitle>
					<CardDescription>
						Configure when you want to receive reminders to complete tasks. {canManage && "Set household defaults and "}
						customize your personal preferences.
					</CardDescription>
				</div>
				{content}
			</section>
		);
	}

	return content;
};
