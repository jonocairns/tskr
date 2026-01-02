"use client";

import { ClipboardListIcon, HomeIcon, LinkIcon, LogOutIcon, ShieldIcon } from "lucide-react";
import Link from "next/link";
import { signIn, signOut, useSession } from "next-auth/react";
import { useEffect } from "react";

import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/Avatar";
import { Button } from "@/components/ui/Button";
import {
	DropdownMenu,
	DropdownMenuContent,
	DropdownMenuItem,
	DropdownMenuSeparator,
	DropdownMenuTrigger,
} from "@/components/ui/DropdownMenu";
import { useToast } from "@/hooks/useToast";
import { trpc } from "@/lib/trpc/react";

type Props = {
	user: {
		name?: string | null;
		email?: string | null;
		image?: string | null;
		isSuperAdmin?: boolean;
		hasGoogleAccount?: boolean;
	};
	googleEnabled: boolean;
	household?: {
		id: string;
		role: "DICTATOR" | "APPROVER" | "DOER";
	};
};

export const UserMenu = ({ user, googleEnabled, household }: Props) => {
	const { data: session } = useSession();
	const { toast } = useToast();
	const sessionUser = session?.user;
	const resolvedUser = sessionUser ?? user;

	const householdId = household?.id;
	const currentHouseholdRole = household?.role;
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
				<Button variant="ghost" className="group gap-2 py-6">
					<Avatar className="h-9 w-9 ring-1  ring-ring/25 ring-black transition group-hover:ring-ring/50">
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
				{householdId ? (
					<>
						<DropdownMenuItem asChild>
							<Link href={`/${householdId}/household`}>
								<HomeIcon className="mr-2 h-4 w-4" />
								Household
							</Link>
						</DropdownMenuItem>
						{currentHouseholdRole && currentHouseholdRole !== "DOER" ? (
							<DropdownMenuItem asChild>
								<Link href={`/${householdId}/assignments`}>
									<ClipboardListIcon className="mr-2 h-4 w-4" />
									Assignments
								</Link>
							</DropdownMenuItem>
						) : null}
					</>
				) : null}
				{resolvedUser?.isSuperAdmin ? (
					<DropdownMenuItem asChild>
						<Link href="/admin">
							<ShieldIcon className="mr-2 h-4 w-4" />
							Admin
						</Link>
					</DropdownMenuItem>
				) : null}
				{googleEnabled && !resolvedUser?.hasGoogleAccount ? (
					<DropdownMenuItem
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
					className="text-red-600 font-semibold opacity-100 hover:text-red-600 focus:text-red-600"
					onSelect={() => signOut()}
				>
					<LogOutIcon className="mr-2 h-4 w-4" />
					Sign out
				</DropdownMenuItem>
			</DropdownMenuContent>
		</DropdownMenu>
	);
};
