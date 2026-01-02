import type { ComponentPropsWithoutRef } from "react";

import { Card } from "@/components/ui/Card";
import { cn } from "@/lib/utils";

type Props = ComponentPropsWithoutRef<typeof Card>;

export function DashboardCard({ className, ...props }: Props) {
	return (
		<Card
			className={cn(
				"border-primary/10 bg-gradient-to-br from-primary/5 via-background to-background shadow-sm",
				className,
			)}
			{...props}
		/>
	);
}
