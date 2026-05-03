import Link from "next/link";

import { Button } from "@/components/ui/Button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/Card";
import { Input } from "@/components/ui/Input";
import { Label } from "@/components/ui/Label";
import { addDaysInTimeZone, formatDateInTimeZoneForInput } from "@/lib/timeZones";
import type { WeekViewRange } from "@/lib/week-view/buildTimeline";

type Props = {
	householdId: string;
	range: WeekViewRange;
	timeZone: string;
	labels: {
		title: string;
		description: string;
		from: string;
		to: string;
		apply: string;
		reset: string;
	};
};

export const WeekViewRangeControls = ({ householdId, range, timeZone, labels }: Props) => {
	const fromValue = formatDateInTimeZoneForInput(range.start, timeZone);
	const toValue = formatDateInTimeZoneForInput(addDaysInTimeZone(range.end, -1, timeZone), timeZone);

	return (
		<Card>
			<CardHeader>
				<CardTitle className="text-xl">{labels.title}</CardTitle>
				<CardDescription>{labels.description}</CardDescription>
			</CardHeader>
			<CardContent>
				<form
					action={`/${householdId}/week`}
					method="get"
					className="grid gap-4 md:grid-cols-2 xl:grid-cols-[1fr_1fr_auto_auto] xl:items-end"
				>
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
						<Link href={`/${householdId}/week`}>{labels.reset}</Link>
					</Button>
				</form>
			</CardContent>
		</Card>
	);
};
