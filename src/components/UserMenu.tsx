"use client";

import {
	ClipboardListIcon,
	HomeIcon,
	LogOutIcon,
	LinkIcon,
	ShieldIcon,
	UserRoundIcon,
} from "lucide-react";
import { signIn, signOut } from "next-auth/react";
import Link from "next/link";

import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/Avatar";
import { Button } from "@/components/ui/Button";
import {
	DropdownMenu,
	DropdownMenuContent,
	DropdownMenuItem,
	DropdownMenuLabel,
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
};

export const UserMenu = ({ user }: Props) => {
	const initials =
		user?.name?.slice(0, 1)?.toUpperCase() ??
		user?.email?.slice(0, 1)?.toUpperCase() ??
		"U";

	return (
		<DropdownMenu>
			<DropdownMenuTrigger asChild>
				<Button variant="ghost" className="gap-2 py-6">
					<Avatar className="h-9 w-9">
						<AvatarImage
							src={user?.image ?? undefined}
							alt={user?.name ?? ""}
						/>
						<AvatarFallback>{initials}</AvatarFallback>
					</Avatar>
					<div className="hidden flex-col items-start text-left sm:flex ">
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
				<DropdownMenuItem asChild className="cursor-pointer">
					<Link href="/household">
						<HomeIcon className="mr-2 h-4 w-4" />
						Settings
					</Link>
				</DropdownMenuItem>
				<DropdownMenuItem asChild className="cursor-pointer">
					<Link href="/assignments">
						<ClipboardListIcon className="mr-2 h-4 w-4" />
						Assignments
					</Link>
				</DropdownMenuItem>
				{user?.isSuperAdmin ? (
					<DropdownMenuItem asChild className="cursor-pointer">
						<Link href="/admin">
							<ShieldIcon className="mr-2 h-4 w-4" />
							Admin
						</Link>
					</DropdownMenuItem>
				) : null}
				{user?.hasGoogleAccount ? null : (
					<DropdownMenuItem
						className="cursor-pointer"
						onSelect={() => signIn("google")}
					>
						<LinkIcon className="mr-2 h-4 w-4" />
						Link Google
					</DropdownMenuItem>
				)}
				<DropdownMenuSeparator />
				<DropdownMenuItem
					className="cursor-pointer text-red-600 font-semibold opacity-100 hover:text-red-600 focus:text-red-600"
					onSelect={() => signOut()}
				>
					<LogOutIcon className="mr-2 h-4 w-4" />
					Sign out
				</DropdownMenuItem>
			</DropdownMenuContent>
		</DropdownMenu>
	);
};
