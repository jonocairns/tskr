"use client";

import { useRouter } from "@tanstack/react-router";
import { CheckIcon, ChevronDownIcon, HomeIcon, Loader2Icon } from "lucide-react";
import { useMemo, useTransition } from "react";

import { useSession } from "@/auth/client";
import { Button } from "@/components/ui/Button";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/DropdownMenu";
import { trpc } from "@/lib/trpc/react";

type Props = {
	householdId?: string;
};

export const Switcher = ({ householdId: propsHouseholdId }: Props) => {
	const [isPending, startTransition] = useTransition();
	const router = useRouter();
	const { data: session, isPending: isSessionPending } = useSession();
	const isAuthenticated = !isSessionPending && !!session?.user;

	const { data, isLoading } = trpc.households.list.useQuery(undefined, {
		enabled: isAuthenticated,
	});

	const households = data?.households ?? [];
	const activeHouseholdId = propsHouseholdId ?? data?.activeHouseholdId ?? null;

	const activeHousehold = useMemo(
		() => households.find((household: { id: string }) => household.id === activeHouseholdId) ?? households[0] ?? null,
		[households, activeHouseholdId],
	);

	const selectMutation = trpc.households.select.useMutation({
		onSuccess: (_data, variables) => {
			router.navigate({ to: `/${variables.householdId}` });
		},
	});

	const handleSelect = (householdId: string) => {
		if (householdId === activeHouseholdId || isPending) {
			return;
		}

		startTransition(() => {
			selectMutation.mutate({ householdId });
		});
	};

	const hasMultipleHouseholds = households.length > 1;

	const buttonContent = (
		<>
			{isLoading ? <Loader2Icon className="h-4 w-4 animate-spin" /> : <HomeIcon className="h-4 w-4" />}
			<span className="max-w-[140px] truncate text-left">{activeHousehold?.name ?? "Household"}</span>
			{hasMultipleHouseholds ? <ChevronDownIcon className="h-4 w-4 text-muted-foreground" /> : null}
		</>
	);

	if (!hasMultipleHouseholds) {
		return null;
	}

	return (
		<DropdownMenu>
			<DropdownMenuTrigger asChild>
				<Button type="button" variant="outline" size="icon" className="w-auto gap-2 px-2" disabled={isLoading}>
					{buttonContent}
				</Button>
			</DropdownMenuTrigger>
			<DropdownMenuContent className="w-56" align="end">
				{households.length === 0 ? (
					<DropdownMenuItem disabled>No households found</DropdownMenuItem>
				) : (
					households.map((household: { id: string; name: string }) => (
						<DropdownMenuItem
							key={household.id}
							onSelect={(event) => {
								event.preventDefault();
								handleSelect(household.id);
							}}
							disabled={isPending}
							className="flex items-center justify-between gap-3"
						>
							<span className="truncate">{household.name}</span>
							{household.id === activeHouseholdId ? <CheckIcon className="h-4 w-4 text-primary" /> : null}
						</DropdownMenuItem>
					))
				)}
			</DropdownMenuContent>
		</DropdownMenu>
	);
};
