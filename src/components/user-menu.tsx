"use client";

import { LogOutIcon, Settings2Icon, UserRoundIcon } from "lucide-react";
import { signOut } from "next-auth/react";

import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import {
	DropdownMenu,
	DropdownMenuContent,
	DropdownMenuItem,
	DropdownMenuLabel,
	DropdownMenuSeparator,
	DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

type Props = {
	user: {
		name?: string | null;
		email?: string | null;
		image?: string | null;
	};
};

export function UserMenu({ user }: Props) {
	const initials =
		user?.name?.slice(0, 1)?.toUpperCase() ??
		user?.email?.slice(0, 1)?.toUpperCase() ??
		"U";

	return (
		<DropdownMenu>
			<DropdownMenuTrigger asChild>
				<Button variant="ghost" className="gap-2 px-2">
					<Avatar className="h-9 w-9">
						<AvatarImage
							src={user?.image ?? undefined}
							alt={user?.name ?? ""}
						/>
						<AvatarFallback>{initials}</AvatarFallback>
					</Avatar>
					<div className="hidden flex-col items-start text-left sm:flex">
						<span className="text-sm font-semibold leading-5">
							{user?.name ?? "Player"}
						</span>
						<span className="text-xs text-muted-foreground">{user?.email}</span>
					</div>
				</Button>
			</DropdownMenuTrigger>
			<DropdownMenuContent className="w-56" align="end">
				<DropdownMenuLabel>Signed in</DropdownMenuLabel>
				<DropdownMenuSeparator />
				<DropdownMenuItem disabled>
					<UserRoundIcon className="mr-2 h-4 w-4" />
					{user?.email ?? "Google account"}
				</DropdownMenuItem>
				<DropdownMenuItem disabled>
					<Settings2Icon className="mr-2 h-4 w-4" />
					Rewards coming soon
				</DropdownMenuItem>
				<DropdownMenuSeparator />
				<DropdownMenuItem
					className="text-destructive focus:text-destructive"
					onSelect={() => signOut()}
				>
					<LogOutIcon className="mr-2 h-4 w-4" />
					Sign out
				</DropdownMenuItem>
			</DropdownMenuContent>
		</DropdownMenu>
	);
}
