"use client";

import { CalendarIcon } from "lucide-react";
import { useRouter } from "next/navigation";
import { useRef, useState, useTransition } from "react";

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
	const fromInputRef = useRef<HTMLInputElement>(null);
	const toInputRef = useRef<HTMLInputElement>(null);

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

	const openPicker = (input: HTMLInputElement | null) => {
		if (!input) {
			return;
		}

		input.focus();
		input.showPicker?.();
	};

	return (
		<div className="flex flex-col items-start gap-3 lg:flex-row lg:items-start lg:justify-between">
			<div className="min-w-0">
				{members.length > 1 ? (
					<WeekViewMemberSelector
						disabled={isPending}
						members={members}
						onChange={onMemberChange}
						selectedUserId={selectedUserId}
						srLabel={labels.member}
					/>
				) : (
					<span className="block truncate text-xl font-semibold">
						{members.find((member) => member.id === selectedUserId)?.label ?? ""}
					</span>
				)}
			</div>
			<div className="flex w-full min-w-0 flex-col items-start gap-3 lg:w-auto lg:items-end">
				<div className="flex w-full flex-wrap items-center gap-2 lg:w-auto lg:justify-end">
					{WEEK_VIEW_PRESETS.map((option) => {
						const isActive = range.labelKey === option;
						return (
							<button
								key={option}
								type="button"
								onClick={() => onPresetChange(option)}
								disabled={isPending}
								className={cn(
									"cursor-pointer rounded-full border px-3 py-1 text-xs font-medium transition-colors disabled:cursor-not-allowed disabled:opacity-50",
									isActive
										? "border-transparent bg-primary text-primary-foreground"
										: "border-border bg-transparent text-muted-foreground hover:border-foreground/30 hover:text-foreground",
								)}
							>
								{labels.presets[option]}
							</button>
						);
					})}
					<Popover open={isPopoverOpen} onOpenChange={onCustomOpen}>
						<PopoverTrigger asChild>
							<button
								type="button"
								aria-label={labels.dateRange}
								disabled={isPending}
								className="inline-flex shrink-0 cursor-pointer items-center gap-2 rounded-md px-2 py-1 text-sm text-muted-foreground transition-colors hover:bg-accent hover:text-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50 lg:ml-1"
							>
								<CalendarIcon className="size-4" aria-hidden />
								<span>{rangeLabel}</span>
							</button>
						</PopoverTrigger>
						<PopoverContent align="end" className="w-auto min-w-[18rem]">
							<form
								onSubmit={(event) => {
									event.preventDefault();
									onApplyCustom();
								}}
								className="space-y-3"
							>
								<div className="space-y-1.5">
									<Label htmlFor="week-view-from">{labels.from}</Label>
									<div className="relative">
										<Input
											ref={fromInputRef}
											id="week-view-from"
											type="date"
											required
											value={draftFrom}
											onChange={(event) => setDraftFrom(event.target.value)}
											className="pr-10 [&::-webkit-calendar-picker-indicator]:opacity-0"
										/>
										<button
											type="button"
											aria-label={labels.from}
											className="absolute inset-y-0 right-0 flex w-10 cursor-pointer items-center justify-center text-muted-foreground transition-colors hover:text-foreground"
											onClick={() => openPicker(fromInputRef.current)}
										>
											<CalendarIcon className="size-4" aria-hidden />
										</button>
									</div>
								</div>
								<div className="space-y-1.5">
									<Label htmlFor="week-view-to">{labels.to}</Label>
									<div className="relative">
										<Input
											ref={toInputRef}
											id="week-view-to"
											type="date"
											required
											value={draftTo}
											onChange={(event) => setDraftTo(event.target.value)}
											className="pr-10 [&::-webkit-calendar-picker-indicator]:opacity-0"
										/>
										<button
											type="button"
											aria-label={labels.to}
											className="absolute inset-y-0 right-0 flex w-10 cursor-pointer items-center justify-center text-muted-foreground transition-colors hover:text-foreground"
											onClick={() => openPicker(toInputRef.current)}
										>
											<CalendarIcon className="size-4" aria-hidden />
										</button>
									</div>
								</div>
								<Button type="submit" className="w-full">
									{labels.apply}
								</Button>
							</form>
						</PopoverContent>
					</Popover>
				</div>
			</div>
		</div>
	);
};
