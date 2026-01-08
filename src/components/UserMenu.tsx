import { Link } from "@tanstack/react-router";
import { ClipboardListIcon, HomeIcon, LogOutIcon, SettingsIcon } from "lucide-react";

import { signOut } from "@/auth/client";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/Avatar";
import {
	DropdownMenu,
	DropdownMenuContent,
	DropdownMenuItem,
	DropdownMenuSeparator,
	DropdownMenuTrigger,
} from "@/components/ui/DropdownMenu";

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
	const householdId = household?.id;
	const currentHouseholdRole = household?.role;
	const initials = user?.name?.slice(0, 1)?.toUpperCase() ?? user?.email?.slice(0, 1)?.toUpperCase() ?? "U";

	const handleSignOut = async () => {
		await signOut({
			fetchOptions: {
				onSuccess: () => {
					window.location.href = "/";
				},
			},
		});
	};

	return (
		<DropdownMenu>
			<DropdownMenuTrigger asChild>
				<Avatar className="h-9 w-9 rounded-md ring-1  ring-ring/25 ring-black transition group-hover:ring-ring/50 cursor-pointer">
					<AvatarImage src={user?.image ?? undefined} alt={user?.name ?? ""} />
					<AvatarFallback className="rounded-md">{initials}</AvatarFallback>
				</Avatar>
			</DropdownMenuTrigger>
			<DropdownMenuContent className="w-56" align="end">
				{householdId ? (
					<>
						<DropdownMenuItem asChild>
							<Link to="/$householdId/household" params={{ householdId }}>
								<HomeIcon className="mr-2 h-4 w-4" />
								Household
							</Link>
						</DropdownMenuItem>
						{currentHouseholdRole && currentHouseholdRole !== "DOER" ? (
							<DropdownMenuItem asChild>
								<Link to="/$householdId/assignments" params={{ householdId }}>
									<ClipboardListIcon className="mr-2 h-4 w-4" />
									Assignments
								</Link>
							</DropdownMenuItem>
						) : null}
						<DropdownMenuItem asChild>
							<Link to="/$householdId/settings" params={{ householdId }}>
								<SettingsIcon className="mr-2 h-4 w-4" />
								Settings
							</Link>
						</DropdownMenuItem>
					</>
				) : null}
				<DropdownMenuSeparator />
				<DropdownMenuItem
					className="text-red-600 font-semibold opacity-100 hover:text-red-600 focus:text-red-600"
					onSelect={handleSignOut}
				>
					<LogOutIcon className="mr-2 h-4 w-4" />
					Sign out
				</DropdownMenuItem>
			</DropdownMenuContent>
		</DropdownMenu>
	);
};
