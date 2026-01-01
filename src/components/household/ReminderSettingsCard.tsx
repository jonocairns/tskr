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

// Helper functions for timezone conversion
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

export const ReminderSettingsCard = ({ canManage, variant = "card" }: Props) => {
	const { isSubscribed } = usePushNotificationStatus();
	const [dailyEnabled, setDailyEnabled] = useState(false);
	const [dailyTime, setDailyTime] = useState("18:00"); // Local time for display
	const [weeklyEnabled, setWeeklyEnabled] = useState(false);
	const [weeklyDay, setWeeklyDay] = useState(1);
	const [weeklyTime, setWeeklyTime] = useState("18:00"); // Local time for display
	const [intervalEnabled, setIntervalEnabled] = useState(false);
	const [intervalDays, setIntervalDays] = useState(7);
	const [eventEnabled, setEventEnabled] = useState(false);
	const [eventDays, setEventDays] = useState(7);

	const [initialValues, setInitialValues] = useState({
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

	const { toast } = useToast();
	const { data, isLoading } = trpc.reminders.getHouseholdConfig.useQuery(undefined, {
		enabled: canManage,
	});
	const utils = trpc.useUtils();

	const updateMutation = trpc.reminders.updateHouseholdConfig.useMutation({
		onSuccess: () => {
			toast({ title: "Reminder settings updated" });
			setInitialValues({
				dailyEnabled,
				dailyTime,
				weeklyEnabled,
				weeklyDay,
				weeklyTime,
				intervalEnabled,
				intervalDays,
				eventEnabled,
				eventDays,
			});
			utils.reminders.getHouseholdConfig.invalidate();
		},
		onError: (error) => {
			toast({
				title: "Failed to update reminder settings",
				description: error.message,
				variant: "destructive",
			});
		},
	});

	useEffect(() => {
		if (data?.config) {
			const localDailyTime = utcToLocal(data.config.dailyReminderTime);
			const localWeeklyTime = utcToLocal(data.config.weeklyReminderTime);

			const values = {
				dailyEnabled: data.config.dailyReminderEnabled,
				dailyTime: localDailyTime,
				weeklyEnabled: data.config.weeklyReminderEnabled,
				weeklyDay: data.config.weeklyReminderDay || 1,
				weeklyTime: localWeeklyTime,
				intervalEnabled: data.config.intervalReminderEnabled,
				intervalDays: data.config.intervalReminderDays || 7,
				eventEnabled: data.config.eventReminderEnabled,
				eventDays: data.config.eventReminderDays || 7,
			};
			setDailyEnabled(values.dailyEnabled);
			setDailyTime(values.dailyTime);
			setWeeklyEnabled(values.weeklyEnabled);
			setWeeklyDay(values.weeklyDay);
			setWeeklyTime(values.weeklyTime);
			setIntervalEnabled(values.intervalEnabled);
			setIntervalDays(values.intervalDays);
			setEventEnabled(values.eventEnabled);
			setEventDays(values.eventDays);
			setInitialValues(values);
		}
	}, [data]);

	if (!canManage) return null;

	const isSection = variant === "section";

	if (!isSubscribed) {
		const warningContent = (
			<div className="space-y-3">
				<p className="text-sm text-muted-foreground">
					Push notifications must be enabled above before you can configure task reminders.
				</p>
			</div>
		);

		if (isSection) {
			return (
				<section className="space-y-3">
					<div className="space-y-1">
						<CardTitle className="text-base">Task Reminders (Household Defaults)</CardTitle>
						<CardDescription>
							Configure default reminder settings for all household members. Members can override these in their
							personal settings.
						</CardDescription>
					</div>
					{warningContent}
				</section>
			);
		}

		return warningContent;
	}

	const handleSave = () => {
		updateMutation.mutate({
			dailyReminderEnabled: dailyEnabled,
			dailyReminderTime: dailyEnabled ? localToUtc(dailyTime) : null,
			weeklyReminderEnabled: weeklyEnabled,
			weeklyReminderDay: weeklyEnabled ? weeklyDay : null,
			weeklyReminderTime: weeklyEnabled ? localToUtc(weeklyTime) : null,
			intervalReminderEnabled: intervalEnabled,
			intervalReminderDays: intervalEnabled ? intervalDays : null,
			eventReminderEnabled: eventEnabled,
			eventReminderDays: eventEnabled ? eventDays : null,
		});
	};

	const isDirty =
		dailyEnabled !== initialValues.dailyEnabled ||
		dailyTime !== initialValues.dailyTime ||
		weeklyEnabled !== initialValues.weeklyEnabled ||
		weeklyDay !== initialValues.weeklyDay ||
		weeklyTime !== initialValues.weeklyTime ||
		intervalEnabled !== initialValues.intervalEnabled ||
		intervalDays !== initialValues.intervalDays ||
		eventEnabled !== initialValues.eventEnabled ||
		eventDays !== initialValues.eventDays;

	const isPending = updateMutation.isPending;

	const content = (
		<div className="space-y-6">
			<div className="space-y-3">
				<div className="flex items-center justify-between">
					<Label htmlFor="daily-enabled">Daily Reminder</Label>
					<Switch
						id="daily-enabled"
						checked={dailyEnabled}
						onCheckedChange={setDailyEnabled}
						disabled={isLoading || isPending}
					/>
				</div>
				{dailyEnabled && (
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
			</div>

			<div className="space-y-3">
				<div className="flex items-center justify-between">
					<Label htmlFor="weekly-enabled">Weekly Reminder</Label>
					<Switch
						id="weekly-enabled"
						checked={weeklyEnabled}
						onCheckedChange={setWeeklyEnabled}
						disabled={isLoading || isPending}
					/>
				</div>
				{weeklyEnabled && (
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
			</div>

			<div className="space-y-3">
				<div className="flex items-center justify-between">
					<Label htmlFor="interval-enabled">Interval Reminder</Label>
					<Switch
						id="interval-enabled"
						checked={intervalEnabled}
						onCheckedChange={setIntervalEnabled}
						disabled={isLoading || isPending}
					/>
				</div>
				{intervalEnabled && (
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
			</div>

			<div className="space-y-3">
				<div className="flex items-center justify-between">
					<Label htmlFor="event-enabled">Event-Based Reminder</Label>
					<Switch
						id="event-enabled"
						checked={eventEnabled}
						onCheckedChange={setEventEnabled}
						disabled={isLoading || isPending}
					/>
				</div>
				{eventEnabled && (
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
			</div>

			<Button onClick={handleSave} disabled={isLoading || isPending || !isDirty}>
				Save Reminder Settings
			</Button>
		</div>
	);

	if (isSection) {
		return (
			<section className="space-y-3">
				<div className="space-y-1">
					<CardTitle className="text-base">Task Reminders (Household Defaults)</CardTitle>
					<CardDescription>
						Configure default reminder settings for all household members. Members can override these in their personal
						settings.
					</CardDescription>
				</div>
				{content}
			</section>
		);
	}

	return content;
};
