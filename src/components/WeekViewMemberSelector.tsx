"use client";

import { ChevronDown } from "lucide-react";

import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/Select";

type Props = {
	disabled?: boolean;
	members: { id: string; label: string }[];
	onChange: (nextUserId: string) => void;
	selectedUserId: string;
	srLabel: string;
};

export const WeekViewMemberSelector = ({ disabled, members, onChange, selectedUserId, srLabel }: Props) => {
	return (
		<Select value={selectedUserId} onValueChange={onChange} disabled={disabled}>
			<SelectTrigger
				aria-label={srLabel}
				className="h-auto w-auto gap-2 border-none bg-transparent p-0 text-xl font-semibold shadow-none hover:text-foreground/80 focus:ring-0 focus-visible:ring-0 [&>svg:last-child]:hidden"
			>
				<SelectValue />
				<ChevronDown className="size-4 text-muted-foreground" aria-hidden />
			</SelectTrigger>
			<SelectContent align="start">
				{members.map((member) => (
					<SelectItem key={member.id} value={member.id}>
						{member.label}
					</SelectItem>
				))}
			</SelectContent>
		</Select>
	);
};
