import Link from "next/link";

import { Button } from "@/components/ui/Button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/Card";
import { Input } from "@/components/ui/Input";
import { Label } from "@/components/ui/Label";
import { WeekViewMemberSelector } from "@/components/WeekViewMemberSelector";
import { addDaysInTimeZone, formatDateInTimeZoneForInput } from "@/lib/timeZones";
import type { WeekViewRange } from "@/lib/week-view/buildTimeline";

type Props = {
	actingUserId: string;
	householdId: string;
	members: { id: string; label: string }[];
	range: WeekViewRange;
	selectedUserId: string;
	timeZone: string;
	labels: {
		title: string;
		description: string;
		member: string;
		from: string;
		to: string;
		apply: string;
		reset: string;
	};
};

export const WeekViewRangeControls = ({
	actingUserId,
	householdId,
	members,
	range,
	selectedUserId,
	timeZone,
	labels,
}: Props) => {
	const fromValue = formatDateInTimeZoneForInput(range.start, timeZone);
	const toValue = formatDateInTimeZoneForInput(addDaysInTimeZone(range.end, -1, timeZone), timeZone);
	const resetHref =
		selectedUserId === actingUserId ? `/${householdId}/week` : `/${householdId}/week?userId=${selectedUserId}`;

	return (
		<Card>
			<CardHeader>
				<CardTitle className="text-xl">{labels.title}</CardTitle>
				<CardDescription>{labels.description}</CardDescription>
			</CardHeader>
			<CardContent className="space-y-4">
				{members.length > 1 ? (
					<WeekViewMemberSelector
						actingUserId={actingUserId}
						householdId={householdId}
						members={members}
						range={range}
						selectedUserId={selectedUserId}
						timeZone={timeZone}
						labels={{ member: labels.member }}
					/>
				) : null}
				<form
					action={`/${householdId}/week`}
					method="get"
					className="grid gap-4 md:grid-cols-2 xl:grid-cols-[1fr_1fr_auto_auto] xl:items-end"
				>
					{selectedUserId !== actingUserId ? <input type="hidden" name="userId" value={selectedUserId} /> : null}
					<div className="space-y-2">
						<Label htmlFor="week-view-from">{labels.from}</Label>
						<Input id="week-view-from" name="from" type="date" required defaultValue={fromValue} />
					</div>
					<div className="space-y-2">
						<Label htmlFor="week-view-to">{labels.to}</Label>
						<Input id="week-view-to" name="to" type="date" required defaultValue={toValue} />
					</div>
					<Button type="submit" className="w-full xl:w-auto">
						{labels.apply}
					</Button>
					<Button asChild variant="outline" className="w-full xl:w-auto">
						<Link href={resetHref}>{labels.reset}</Link>
					</Button>
				</form>
			</CardContent>
		</Card>
	);
};
