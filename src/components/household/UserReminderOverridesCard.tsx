"use client";

import { useEffect, useState } from "react";

import { Button } from "@/components/ui/Button";
import { CardDescription, CardTitle } from "@/components/ui/Card";
import { Input } from "@/components/ui/Input";
import { Label } from "@/components/ui/Label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/Select";
import { usePushNotificationStatus } from "@/contexts/PushNotificationContext";
import { useToast } from "@/hooks/useToast";
import { trpc } from "@/lib/trpc/react";

type Props = {
	householdId: string;
	userId: string;
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

export const UserReminderOverridesCard = ({ variant = "card" }: Props) => {
	const { isSubscribed } = usePushNotificationStatus();
	const [isPaused, setIsPaused] = useState(false);
	const [pauseDays, setPauseDays] = useState(7);

	// Override states (null = use household default)
	const [dailyOverride, setDailyOverride] = useState<"default" | "enabled" | "disabled">("default");
	const [dailyTime, setDailyTime] = useState("18:00");
	const [weeklyOverride, setWeeklyOverride] = useState<"default" | "enabled" | "disabled">("default");
	const [weeklyDay, setWeeklyDay] = useState(1);
	const [weeklyTime, setWeeklyTime] = useState("18:00");
	const [intervalOverride, setIntervalOverride] = useState<"default" | "enabled" | "disabled">("default");
	const [intervalDays, setIntervalDays] = useState(7);
	const [eventOverride, setEventOverride] = useState<"default" | "enabled" | "disabled">("default");
	const [eventDays, setEventDays] = useState(7);

	const [initialValues, setInitialValues] = useState({
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

	const { toast } = useToast();
	const { data: overrideData, isLoading: isLoadingOverride } = trpc.reminders.getUserOverride.useQuery();
	const { data: householdData, isLoading: isLoadingHousehold } = trpc.reminders.getHouseholdConfig.useQuery();
	const utils = trpc.useUtils();

	const updateMutation = trpc.reminders.updateUserOverride.useMutation({
		onSuccess: () => {
			toast({ title: "Personal reminder settings updated" });
			setInitialValues({
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
				title: "Failed to update reminder settings",
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
		if (overrideData?.override) {
			const override = overrideData.override;
			const now = new Date();
			const paused = override.isPaused && (!override.pausedUntil || override.pausedUntil > now);
			setIsPaused(paused);

			// Set override states
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
			setInitialValues(values);
		}
	}, [overrideData]);

	const handlePause = () => {
		pauseMutation.mutate({ days: pauseDays });
	};

	const handleResume = () => {
		resumeMutation.mutate();
	};

	const handleSave = () => {
		updateMutation.mutate({
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
	const isPending = pauseMutation.isPending || resumeMutation.isPending || updateMutation.isPending;
	const isLoading = isLoadingOverride || isLoadingHousehold;

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
						<CardTitle className="text-base">Your Personal Reminder Settings</CardTitle>
						<CardDescription>Manage your reminder preferences and pause reminders temporarily.</CardDescription>
					</div>
					{warningContent}
				</section>
			);
		}

		return warningContent;
	}

	const isDirty =
		dailyOverride !== initialValues.dailyOverride ||
		dailyTime !== initialValues.dailyTime ||
		weeklyOverride !== initialValues.weeklyOverride ||
		weeklyDay !== initialValues.weeklyDay ||
		weeklyTime !== initialValues.weeklyTime ||
		intervalOverride !== initialValues.intervalOverride ||
		intervalDays !== initialValues.intervalDays ||
		eventOverride !== initialValues.eventOverride ||
		eventDays !== initialValues.eventDays;

	// Get household defaults for display
	const householdDailyTime = householdData?.config?.dailyReminderTime
		? utcToLocal(householdData.config.dailyReminderTime)
		: "18:00";
	const householdWeeklyDay = householdData?.config?.weeklyReminderDay ?? 1;
	const householdWeeklyTime = householdData?.config?.weeklyReminderTime
		? utcToLocal(householdData.config.weeklyReminderTime)
		: "18:00";
	const householdIntervalDays = householdData?.config?.intervalReminderDays ?? 7;
	const householdEventDays = householdData?.config?.eventReminderDays ?? 7;

	const content = (
		<div className="space-y-6">
			{/* Pause controls */}
			<div className="rounded-md border p-4 space-y-3">
				<div className="flex items-center justify-between">
					<div>
						<Label>Reminder Status</Label>
						<p className="text-sm text-muted-foreground">
							{isPaused
								? `Reminders are paused${overrideData?.override?.pausedUntil ? ` until ${overrideData.override.pausedUntil.toLocaleDateString()}` : ""}`
								: "Reminders are active"}
						</p>
					</div>
					<Button
						onClick={isPaused ? handleResume : () => {}}
						disabled={isPending || !isPaused}
						variant={isPaused ? "default" : "outline"}
					>
						{isPaused ? "Resume Reminders" : "Active"}
					</Button>
				</div>

				{!isPaused && (
					<div className="space-y-2">
						<Label htmlFor="pause-days">Pause reminders for</Label>
						<div className="flex gap-2">
							<Input
								id="pause-days"
								type="number"
								min={1}
								max={90}
								value={pauseDays}
								onChange={(e) => setPauseDays(Number(e.target.value))}
								disabled={isPending}
								className="w-24"
							/>
							<span className="self-center text-sm">days</span>
							<Button onClick={handlePause} disabled={isPending} variant="outline" className="ml-auto">
								Pause
							</Button>
						</div>
					</div>
				)}
			</div>

			{/* Override settings */}
			<div className="space-y-6">
				<p className="text-sm text-muted-foreground">
					Configure your personal reminder preferences. You can enable reminders even if they're not configured at the
					household level.
				</p>

				{/* Daily Reminder */}
				<div className="space-y-3">
					<div className="flex items-center justify-between">
						<Label htmlFor="daily-override">Daily Reminder</Label>
						<Select value={dailyOverride} onValueChange={(v) => setDailyOverride(v as typeof dailyOverride)}>
							<SelectTrigger id="daily-override" className="w-[200px]">
								<SelectValue />
							</SelectTrigger>
							<SelectContent>
								<SelectItem value="default">
									{householdData?.config?.dailyReminderEnabled
										? "Use household default"
										: "Disabled (household default)"}
								</SelectItem>
								<SelectItem value="enabled">Enable</SelectItem>
								<SelectItem value="disabled">Disable</SelectItem>
							</SelectContent>
						</Select>
					</div>
					{dailyOverride === "enabled" && (
						<div className="ml-4 space-y-2">
							<Label htmlFor="daily-time">Time (your local time)</Label>
							<Input
								id="daily-time"
								type="time"
								value={dailyTime}
								onChange={(e) => setDailyTime(e.target.value)}
								disabled={isLoading || isPending}
							/>
							<p className="text-sm text-muted-foreground">Send reminder at this time every day</p>
						</div>
					)}
					{dailyOverride === "default" && (
						<p className="ml-4 text-sm text-muted-foreground">
							{householdData?.config?.dailyReminderEnabled
								? `Household default: ${householdDailyTime}`
								: "No household default configured"}
						</p>
					)}
				</div>

				{/* Weekly Reminder */}
				<div className="space-y-3">
					<div className="flex items-center justify-between">
						<Label htmlFor="weekly-override">Weekly Reminder</Label>
						<Select value={weeklyOverride} onValueChange={(v) => setWeeklyOverride(v as typeof weeklyOverride)}>
							<SelectTrigger id="weekly-override" className="w-[200px]">
								<SelectValue />
							</SelectTrigger>
							<SelectContent>
								<SelectItem value="default">
									{householdData?.config?.weeklyReminderEnabled
										? "Use household default"
										: "Disabled (household default)"}
								</SelectItem>
								<SelectItem value="enabled">Enable</SelectItem>
								<SelectItem value="disabled">Disable</SelectItem>
							</SelectContent>
						</Select>
					</div>
					{weeklyOverride === "enabled" && (
						<div className="ml-4 space-y-2">
							<Label htmlFor="weekly-day">Day of Week</Label>
							<Select value={String(weeklyDay)} onValueChange={(v) => setWeeklyDay(Number(v))}>
								<SelectTrigger id="weekly-day">
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
							<Label htmlFor="weekly-time">Time (your local time)</Label>
							<Input
								id="weekly-time"
								type="time"
								value={weeklyTime}
								onChange={(e) => setWeeklyTime(e.target.value)}
								disabled={isLoading || isPending}
							/>
							<p className="text-sm text-muted-foreground">Send reminder on this day and time each week</p>
						</div>
					)}
					{weeklyOverride === "default" && (
						<p className="ml-4 text-sm text-muted-foreground">
							{householdData?.config?.weeklyReminderEnabled
								? `Household default: ${DAYS_OF_WEEK[householdWeeklyDay].label} at ${householdWeeklyTime}`
								: "No household default configured"}
						</p>
					)}
				</div>

				{/* Interval Reminder */}
				<div className="space-y-3">
					<div className="flex items-center justify-between">
						<Label htmlFor="interval-override">Interval Reminder</Label>
						<Select value={intervalOverride} onValueChange={(v) => setIntervalOverride(v as typeof intervalOverride)}>
							<SelectTrigger id="interval-override" className="w-[200px]">
								<SelectValue />
							</SelectTrigger>
							<SelectContent>
								<SelectItem value="default">
									{householdData?.config?.intervalReminderEnabled
										? "Use household default"
										: "Disabled (household default)"}
								</SelectItem>
								<SelectItem value="enabled">Enable</SelectItem>
								<SelectItem value="disabled">Disable</SelectItem>
							</SelectContent>
						</Select>
					</div>
					{intervalOverride === "enabled" && (
						<div className="ml-4 space-y-2">
							<Label htmlFor="interval-days">Every N days</Label>
							<Input
								id="interval-days"
								type="number"
								min={1}
								max={90}
								value={intervalDays}
								onChange={(e) => setIntervalDays(Number(e.target.value))}
								disabled={isLoading || isPending}
							/>
							<p className="text-sm text-muted-foreground">Send reminder every {intervalDays} days</p>
						</div>
					)}
					{intervalOverride === "default" && (
						<p className="ml-4 text-sm text-muted-foreground">
							{householdData?.config?.intervalReminderEnabled
								? `Household default: Every ${householdIntervalDays} days`
								: "No household default configured"}
						</p>
					)}
				</div>

				{/* Event-Based Reminder */}
				<div className="space-y-3">
					<div className="flex items-center justify-between">
						<Label htmlFor="event-override">Event-Based Reminder</Label>
						<Select value={eventOverride} onValueChange={(v) => setEventOverride(v as typeof eventOverride)}>
							<SelectTrigger id="event-override" className="w-[200px]">
								<SelectValue />
							</SelectTrigger>
							<SelectContent>
								<SelectItem value="default">
									{householdData?.config?.eventReminderEnabled
										? "Use household default"
										: "Disabled (household default)"}
								</SelectItem>
								<SelectItem value="enabled">Enable</SelectItem>
								<SelectItem value="disabled">Disable</SelectItem>
							</SelectContent>
						</Select>
					</div>
					{eventOverride === "enabled" && (
						<div className="ml-4 space-y-2">
							<Label htmlFor="event-days">If no tasks completed in N days</Label>
							<Input
								id="event-days"
								type="number"
								min={1}
								max={90}
								value={eventDays}
								onChange={(e) => setEventDays(Number(e.target.value))}
								disabled={isLoading || isPending}
							/>
							<p className="text-sm text-muted-foreground">
								Only send if no tasks completed in the last {eventDays} days
							</p>
						</div>
					)}
					{eventOverride === "default" && (
						<p className="ml-4 text-sm text-muted-foreground">
							{householdData?.config?.eventReminderEnabled
								? `Household default: If no tasks in ${householdEventDays} days`
								: "No household default configured"}
						</p>
					)}
				</div>

				<Button onClick={handleSave} disabled={isLoading || isPending || !isDirty} className="w-full">
					{isPending ? "Saving..." : "Save Reminder Settings"}
				</Button>
			</div>
		</div>
	);

	if (isSection) {
		return (
			<section className="space-y-3">
				<div className="space-y-1">
					<CardTitle className="text-base">Your Personal Reminder Settings</CardTitle>
					<CardDescription>Manage your reminder preferences and pause reminders temporarily.</CardDescription>
				</div>
				{content}
			</section>
		);
	}

	return content;
};
