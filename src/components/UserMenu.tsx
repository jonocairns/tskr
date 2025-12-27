"use client";

import {
	ClipboardListIcon,
	HomeIcon,
	LinkIcon,
	LogOutIcon,
	ShieldIcon,
	UserRoundIcon,
} from "lucide-react";
import { signIn, signOut, useSession } from "next-auth/react";
import Link from "next/link";
import { useEffect } from "react";

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
import { useToast } from "@/hooks/use-toast";

type Props = {
	user: {
		name?: string | null;
		email?: string | null;
		image?: string | null;
		isSuperAdmin?: boolean;
		hasGoogleAccount?: boolean;
		hasHouseholdMembership?: boolean;
	};
};

export const UserMenu = ({ user }: Props) => {
	const { data: session } = useSession();
	const { toast } = useToast();
	const sessionUser = session?.user;
	const resolvedUser = sessionUser ?? user;
	const initials =
		resolvedUser?.name?.slice(0, 1)?.toUpperCase() ??
		resolvedUser?.email?.slice(0, 1)?.toUpperCase() ??
		"U";

	useEffect(() => {
		if (typeof window === "undefined") {
			return;
		}
		const flag = window.sessionStorage.getItem("googleLinkSuccess");
		if (!flag) {
			return;
		}
		window.sessionStorage.removeItem("googleLinkSuccess");
		toast({
			title: "Google account linked",
			description: "Your profile has been updated.",
		});
	}, [toast]);

	return (
		<DropdownMenu>
			<DropdownMenuTrigger asChild>
				<Button variant="ghost" className="gap-2 py-6">
					<Avatar className="h-9 w-9">
						<AvatarImage
							src={resolvedUser?.image ?? undefined}
							alt={resolvedUser?.name ?? ""}
						/>
						<AvatarFallback>{initials}</AvatarFallback>
					</Avatar>
					<div className="hidden flex-col items-start text-left sm:flex ">
						<span className="text-sm font-semibold leading-5">
							{resolvedUser?.name ?? "User"}
						</span>
						<span className="text-xs text-muted-foreground">
							{resolvedUser?.email}
						</span>
					</div>
				</Button>
			</DropdownMenuTrigger>
			<DropdownMenuContent className="w-56" align="end">
				<DropdownMenuLabel>Signed in</DropdownMenuLabel>
				<DropdownMenuSeparator />
				<DropdownMenuItem disabled>
					<UserRoundIcon className="mr-2 h-4 w-4" />
					{resolvedUser?.email ?? "Google account"}
				</DropdownMenuItem>
				{resolvedUser?.hasHouseholdMembership ? (
					<>
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
					</>
				) : null}
				{resolvedUser?.isSuperAdmin ? (
					<DropdownMenuItem asChild className="cursor-pointer">
						<Link href="/admin">
							<ShieldIcon className="mr-2 h-4 w-4" />
							Admin
						</Link>
					</DropdownMenuItem>
				) : null}
				{resolvedUser?.hasGoogleAccount ? null : (
					<DropdownMenuItem
						className="cursor-pointer"
						onSelect={() => {
							const returnTo =
								window.location.pathname +
								window.location.search +
								window.location.hash;
							signIn("google", {
								callbackUrl: `/auth/link?returnTo=${encodeURIComponent(
									returnTo,
								)}`,
							});
						}}
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
