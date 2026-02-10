import type { ComponentPropsWithoutRef } from "react";

import { Card } from "@/components/ui/Card";
import { cn } from "@/lib/utils";

type Props = ComponentPropsWithoutRef<typeof Card>;

export function DashboardCard({ className, style, ...props }: Props) {
	return (
		<Card
			className={cn("border-border/80 bg-card bg-none shadow-sm", className)}
			style={{ ...style, backgroundColor: "var(--color-card)", backgroundImage: "none" }}
			{...props}
		/>
	);
}
