"use client";

import { useRouter } from "next/navigation";
import { useTransition } from "react";

import { Label } from "@/components/ui/Label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/Select";
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
		member: string;
	};
};

export const WeekViewMemberSelector = ({
	actingUserId,
	householdId,
	members,
	range,
	selectedUserId,
	timeZone,
	labels,
}: Props) => {
	const router = useRouter();
	const [isPending, startTransition] = useTransition();

	const handleValueChange = (nextUserId: string) => {
		if (nextUserId === selectedUserId) {
			return;
		}

		const params = new URLSearchParams();
		if (nextUserId !== actingUserId) {
			params.set("userId", nextUserId);
		}
		if (range.labelKey === "custom") {
			params.set("from", formatDateInTimeZoneForInput(range.start, timeZone));
			params.set("to", formatDateInTimeZoneForInput(addDaysInTimeZone(range.end, -1, timeZone), timeZone));
		}

		const query = params.toString();
		const href = query ? `/${householdId}/week?${query}` : `/${householdId}/week`;

		startTransition(() => {
			router.push(href);
		});
	};

	return (
		<div className="space-y-2">
			<Label htmlFor="week-view-member">{labels.member}</Label>
			<Select value={selectedUserId} onValueChange={handleValueChange} disabled={isPending}>
				<SelectTrigger id="week-view-member">
					<SelectValue />
				</SelectTrigger>
				<SelectContent>
					{members.map((member) => (
						<SelectItem key={member.id} value={member.id}>
							{member.label}
						</SelectItem>
					))}
				</SelectContent>
			</Select>
		</div>
	);
};
