"use client";

import { CalendarDaysIcon, ClipboardListIcon, HomeIcon, LogOutIcon, SettingsIcon } from "lucide-react";
import Link from "next/link";
import { signOut, useSession } from "next-auth/react";

import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/Avatar";
import {
	DropdownMenu,
	DropdownMenuContent,
	DropdownMenuItem,
	DropdownMenuSeparator,
	DropdownMenuTrigger,
} from "@/components/ui/DropdownMenu";
import { useTranslation } from "@/lib/i18nClient";

type Props = {
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

export const UserMenu = ({ user, household }: Props) => {
	const { data: session } = useSession();
	const { t } = useTranslation();
	const sessionUser = session?.user;
	const resolvedUser = sessionUser ?? user;

	const householdId = household?.id;
	const currentHouseholdRole = household?.role;
	const name = resolvedUser?.name?.slice(0, 1)?.toUpperCase();
	const email = resolvedUser?.email?.slice(0, 1)?.toUpperCase();
	const initials = name ?? email ?? "U";

	return (
		<DropdownMenu>
			<DropdownMenuTrigger asChild>
				<Avatar className="h-9 w-9 rounded-md ring-1  ring-ring/25 ring-black transition group-hover:ring-ring/50 cursor-pointer">
					<AvatarImage src={resolvedUser?.image ?? undefined} alt={resolvedUser?.name ?? ""} />
					<AvatarFallback className="rounded-md">{initials}</AvatarFallback>
				</Avatar>
			</DropdownMenuTrigger>
			<DropdownMenuContent className="w-56" align="end">
				{householdId ? (
					<>
						<DropdownMenuItem asChild>
							<Link href={`/${householdId}/household`}>
								<HomeIcon className="mr-2 h-4 w-4" />
								{t("Household")}
							</Link>
						</DropdownMenuItem>
						<DropdownMenuItem asChild>
							<Link href={`/${householdId}/week`}>
								<CalendarDaysIcon className="mr-2 h-4 w-4" />
								{t("Week view")}
							</Link>
						</DropdownMenuItem>
						{currentHouseholdRole && currentHouseholdRole !== "DOER" ? (
							<DropdownMenuItem asChild>
								<Link href={`/${householdId}/assignments`}>
									<ClipboardListIcon className="mr-2 h-4 w-4" />
									{t("Assignments")}
								</Link>
							</DropdownMenuItem>
						) : null}
						<DropdownMenuItem asChild>
							<Link href={`/${householdId}/settings`}>
								<SettingsIcon className="mr-2 h-4 w-4" />
								{t("Settings")}
							</Link>
						</DropdownMenuItem>
						<DropdownMenuSeparator />
					</>
				) : null}

				<DropdownMenuItem
					className="text-red-600 font-semibold opacity-100 hover:text-red-600 focus:text-red-600"
					onSelect={() => signOut()}
				>
					<LogOutIcon className="mr-2 h-4 w-4" />
					{t("Sign out")}
				</DropdownMenuItem>
			</DropdownMenuContent>
		</DropdownMenu>
	);
};
