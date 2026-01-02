import { ChevronLeftIcon } from "lucide-react";
import Link from "next/link";
import { Switcher } from "@/components/household/Switcher";
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
	user,
	household,
}: Props) => {
	return (
		<header className="flex items-start justify-between">
			<div className="flex items-center gap-3 flex-1">
				{backHref ? (
					<Button asChild variant="ghost" size="icon" className="h-16 w-12 min-w-12">
						<Link href={backHref} aria-label={backLabel}>
							<ChevronLeftIcon className="h-5 w-5" />
						</Link>
					</Button>
				) : null}
				<TitleBlock eyebrow={eyebrow} title={title} description={description} />
			</div>
			<div className="flex items-center gap-2">
				<Switcher householdId={household?.id} />
				<UserMenu user={user} household={household} />
			</div>
		</header>
	);
};

type TitleBlockProps = Pick<Props, "title" | "description" | "eyebrow">;

const TitleBlock = ({ title, description, eyebrow }: TitleBlockProps) => (
	<div>
		{eyebrow ? <p className="text-xs font-semibold uppercase tracking-[0.2em] text-primary">{eyebrow}</p> : null}
		<h1 className="text-3xl font-semibold tracking-tight">{title}</h1>
		{description ? <p className="text-sm text-muted-foreground">{description}</p> : null}
	</div>
);
