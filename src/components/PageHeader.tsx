import { ChevronLeftIcon } from "lucide-react";
import Link from "next/link";
import { Switcher } from "@/components/household/Switcher";
import { UserMenu } from "@/components/UserMenu";

type Props = {
	title: string;
	description?: string;
	eyebrow?: string;
	backHref?: string;
	backLabel?: string;
	/** Visible destination name for the back link, e.g. "Dashboard". */
	backText?: string;
	user: {
		name?: string | null;
		email?: string | null;
		image?: string | null;
		isSuperAdmin?: boolean;
		hasGoogleAccount?: boolean;
	};
	household?: {
		id: string;
		role: "DICTATOR" | "APPROVER" | "DOER";
	};
};

export const PageHeader = ({
	title,
	description,
	eyebrow,
	backHref,
	backLabel = "Back",
	backText = "Back",
	user,
	household,
}: Props) => (
	<header className="flex flex-col gap-1">
		<div className="flex min-h-9 items-center justify-between gap-3">
			{backHref ? (
				<Link
					href={backHref}
					aria-label={backLabel}
					className="-my-2 -ml-1.5 inline-flex min-h-11 items-center gap-0.5 rounded-md pl-0.5 pr-2 text-xs font-semibold uppercase tracking-[0.2em] text-muted-foreground transition-colors hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
				>
					<ChevronLeftIcon aria-hidden="true" className="h-4 w-4" />
					{backText}
				</Link>
			) : eyebrow ? (
				<p className="text-xs font-semibold uppercase tracking-[0.2em] text-primary">{eyebrow}</p>
			) : (
				<span />
			)}
			<div className="flex shrink-0 items-center gap-2">
				<Switcher householdId={household?.id} />
				<UserMenu user={user} household={household} />
			</div>
		</div>
		<TitleBlock title={title} description={description} />
	</header>
);

type TitleBlockProps = Pick<Props, "title" | "description">;

const TitleBlock = ({ title, description }: TitleBlockProps) => (
	<div>
		<h1 className="text-3xl font-semibold tracking-tight">{title}</h1>
		{description ? <p className="text-sm text-muted-foreground">{description}</p> : null}
	</div>
);
