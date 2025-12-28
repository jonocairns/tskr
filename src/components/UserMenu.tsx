"use client";

import { ClipboardListIcon, HomeIcon, LinkIcon, LogOutIcon, ShieldIcon, UserRoundIcon } from "lucide-react";
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
		householdRole?: "DICTATOR" | "APPROVER" | "DOER" | null;
		isSuperAdmin?: boolean;
		hasGoogleAccount?: boolean;
		hasHouseholdMembership?: boolean;
	};
	googleEnabled: boolean;
};

export const UserMenu = ({ user, googleEnabled }: Props) => {
	const { data: session } = useSession();
	const { toast } = useToast();
	const sessionUser = session?.user;
	const resolvedUser = sessionUser ?? user;
	const initials =
		resolvedUser?.name?.slice(0, 1)?.toUpperCase() ?? resolvedUser?.email?.slice(0, 1)?.toUpperCase() ?? "U";

	useEffect(() => {
		if (!googleEnabled) {
			return;
		}
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
	}, [googleEnabled, toast]);

	return (
		<DropdownMenu>
			<DropdownMenuTrigger asChild>
				<Button variant="ghost" className="gap-2 py-6">
					<Avatar className="h-9 w-9">
						<AvatarImage src={resolvedUser?.image ?? undefined} alt={resolvedUser?.name ?? ""} />
						<AvatarFallback>{initials}</AvatarFallback>
					</Avatar>
					<div className="hidden flex-col items-start text-left sm:flex ">
						<span className="text-sm font-semibold leading-5">{resolvedUser?.name ?? "User"}</span>
						<span className="text-xs text-muted-foreground">{resolvedUser?.email}</span>
					</div>
				</Button>
			</DropdownMenuTrigger>
			<DropdownMenuContent className="w-56" align="end">
				{resolvedUser?.hasHouseholdMembership ? (
					<>
						<DropdownMenuItem asChild className="cursor-pointer">
							<Link href="/household">
								<HomeIcon className="mr-2 h-4 w-4" />
								Household
							</Link>
						</DropdownMenuItem>
						{resolvedUser?.householdRole !== "DOER" ? (
							<DropdownMenuItem asChild className="cursor-pointer">
								<Link href="/assignments">
									<ClipboardListIcon className="mr-2 h-4 w-4" />
									Assignments
								</Link>
							</DropdownMenuItem>
						) : null}
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
				{googleEnabled && !resolvedUser?.hasGoogleAccount ? (
					<DropdownMenuItem
						className="cursor-pointer"
						onSelect={() => {
							const returnTo = window.location.pathname + window.location.search + window.location.hash;
							signIn("google", {
								callbackUrl: `/auth/link?returnTo=${encodeURIComponent(returnTo)}`,
							});
						}}
					>
						<LinkIcon className="mr-2 h-4 w-4" />
						Link Google
					</DropdownMenuItem>
				) : null}
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
