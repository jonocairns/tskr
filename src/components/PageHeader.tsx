import { ChevronLeftIcon } from "lucide-react";
import Link from "next/link";

import { Switcher } from "@/components/household/Switcher";
import { ModeToggle } from "@/components/ModeToggle";
import { UserMenu } from "@/components/UserMenu";
import { Button } from "@/components/ui/Button";

type Props = {
	title: string;
	description?: string;
	eyebrow?: string;
	backHref?: string;
	backLabel?: string;
	user: {
		name?: string | null;
		email?: string | null;
		image?: string | null;
	};
};

export const PageHeader = ({
	title,
	description,
	eyebrow,
	backHref,
	backLabel = "Back",
	user,
}: Props) => (
	<header className="flex items-start justify-between">
		<div className="flex items-start gap-3">
			{backHref ? (
				<Button asChild variant="ghost" size="icon">
					<Link href={backHref} aria-label={backLabel}>
						<ChevronLeftIcon className="h-5 w-5" />
					</Link>
				</Button>
			) : null}
			<div>
				{eyebrow ? (
					<p className="text-xs font-semibold uppercase tracking-[0.2em] text-primary">
						{eyebrow}
					</p>
				) : null}
				<h1 className="text-3xl font-semibold tracking-tight">{title}</h1>
				{description ? (
					<p className="text-sm text-muted-foreground">{description}</p>
				) : null}
			</div>
		</div>
		<div className="flex items-center gap-2">
			<ModeToggle />
			<Switcher />
			<UserMenu user={user} />
		</div>
	</header>
);
