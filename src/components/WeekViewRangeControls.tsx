"use client";

import { CalendarIcon } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";

import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Label } from "@/components/ui/Label";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/Popover";
import { WeekViewMemberSelector } from "@/components/WeekViewMemberSelector";
import { type DateFormat, formatDate } from "@/lib/formatDate";
import { addDaysInTimeZone, formatDateInTimeZoneForInput } from "@/lib/timeZones";
import { cn } from "@/lib/utils";
import { WEEK_VIEW_PRESETS, type WeekViewPreset, type WeekViewRange } from "@/lib/week-view/buildTimeline";

type Props = {
	actingUserId: string;
	dateFormat: DateFormat;
	householdId: string;
	members: { id: string; label: string }[];
	range: WeekViewRange;
	selectedUserId: string;
	timeZone: string;
	labels: {
		member: string;
		dateRange: string;
		from: string;
		to: string;
		apply: string;
		reset: string;
		presets: Record<WeekViewPreset, string>;
	};
};

const buildHref = ({
	householdId,
	actingUserId,
	selectedUserId,
	preset,
	from,
	to,
}: {
	householdId: string;
	actingUserId: string;
	selectedUserId: string;
	preset?: WeekViewPreset | null;
	from?: string | null;
	to?: string | null;
}) => {
	const params = new URLSearchParams();
	if (selectedUserId !== actingUserId) {
		params.set("userId", selectedUserId);
	}
	if (preset) {
		params.set("preset", preset);
	} else if (from && to) {
		params.set("from", from);
		params.set("to", to);
	}
	const query = params.toString();
	return query ? `/${householdId}/week?${query}` : `/${householdId}/week`;
};

export const WeekViewRangeControls = ({
	actingUserId,
	dateFormat,
	householdId,
	members,
	range,
	selectedUserId,
	timeZone,
	labels,
}: Props) => {
	const router = useRouter();
	const [isPending, startTransition] = useTransition();
	const [isPopoverOpen, setIsPopoverOpen] = useState(false);

	const fromInput = formatDateInTimeZoneForInput(range.start, timeZone);
	const toInput = formatDateInTimeZoneForInput(addDaysInTimeZone(range.end, -1, timeZone), timeZone);
	const [draftFrom, setDraftFrom] = useState(fromInput);
	const [draftTo, setDraftTo] = useState(toInput);

	const navigate = (href: string) => {
		startTransition(() => {
			router.push(href);
		});
	};

	const onMemberChange = (nextUserId: string) => {
		if (nextUserId === selectedUserId) return;
		const preserveCustom = range.labelKey === "custom";
		navigate(
			buildHref({
				householdId,
				actingUserId,
				selectedUserId: nextUserId,
				preset: preserveCustom ? null : (range.labelKey as WeekViewPreset),
				from: preserveCustom ? fromInput : null,
				to: preserveCustom ? toInput : null,
			}),
		);
	};

	const onPresetChange = (preset: WeekViewPreset) => {
		if (range.labelKey === preset) return;
		navigate(
			buildHref({
				householdId,
				actingUserId,
				selectedUserId,
				preset,
			}),
		);
	};

	const onCustomOpen = (open: boolean) => {
		if (open) {
			setDraftFrom(fromInput);
			setDraftTo(toInput);
		}
		setIsPopoverOpen(open);
	};

	const onApplyCustom = () => {
		if (!draftFrom || !draftTo) return;
		setIsPopoverOpen(false);
		navigate(
			buildHref({
				householdId,
				actingUserId,
				selectedUserId,
				from: draftFrom,
				to: draftTo,
			}),
		);
	};

	const rangeLabel = `${formatDate(range.start, { timeZone, dateFormat })} – ${formatDate(
		addDaysInTimeZone(range.end, -1, timeZone),
		{ timeZone, dateFormat },
	)}`;

	const showReset = range.labelKey !== "thisWeek";

	return (
		<div className="space-y-3">
			<div className="flex flex-wrap items-center gap-x-3 gap-y-2">
				{members.length > 1 ? (
					<WeekViewMemberSelector
						disabled={isPending}
						members={members}
						onChange={onMemberChange}
						selectedUserId={selectedUserId}
						srLabel={labels.member}
					/>
				) : (
					<span className="text-xl font-semibold">
						{members.find((member) => member.id === selectedUserId)?.label ?? ""}
					</span>
				)}
				<Popover open={isPopoverOpen} onOpenChange={onCustomOpen}>
					<PopoverTrigger asChild>
						<button
							type="button"
							aria-label={labels.dateRange}
							disabled={isPending}
							className="inline-flex items-center gap-2 rounded-md px-2 py-1 text-sm text-muted-foreground transition-colors hover:bg-accent hover:text-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:opacity-50"
						>
							<CalendarIcon className="size-4" aria-hidden />
							<span>{rangeLabel}</span>
						</button>
					</PopoverTrigger>
					<PopoverContent align="start" className="w-auto min-w-[18rem]">
						<form
							onSubmit={(event) => {
								event.preventDefault();
								onApplyCustom();
							}}
							className="space-y-3"
						>
							<div className="space-y-1.5">
								<Label htmlFor="week-view-from">{labels.from}</Label>
								<Input
									id="week-view-from"
									type="date"
									required
									value={draftFrom}
									onChange={(event) => setDraftFrom(event.target.value)}
								/>
							</div>
							<div className="space-y-1.5">
								<Label htmlFor="week-view-to">{labels.to}</Label>
								<Input
									id="week-view-to"
									type="date"
									required
									value={draftTo}
									onChange={(event) => setDraftTo(event.target.value)}
								/>
							</div>
							<Button type="submit" className="w-full">
								{labels.apply}
							</Button>
						</form>
					</PopoverContent>
				</Popover>
			</div>
			<div className="flex flex-wrap items-center gap-2">
				{WEEK_VIEW_PRESETS.map((option) => {
					const isActive = range.labelKey === option;
					return (
						<button
							key={option}
							type="button"
							onClick={() => onPresetChange(option)}
							disabled={isPending}
							className={cn(
								"rounded-full border px-3 py-1 text-xs font-medium transition-colors disabled:opacity-50",
								isActive
									? "border-transparent bg-primary text-primary-foreground"
									: "border-border bg-transparent text-muted-foreground hover:border-foreground/30 hover:text-foreground",
							)}
						>
							{labels.presets[option]}
						</button>
					);
				})}
				{showReset ? (
					<button
						type="button"
						onClick={() => onPresetChange("thisWeek")}
						disabled={isPending}
						className="ml-auto text-xs text-muted-foreground underline-offset-4 hover:text-foreground hover:underline disabled:opacity-50"
					>
						{labels.reset}
					</button>
				) : null}
			</div>
		</div>
	);
};
