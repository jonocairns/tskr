"use client";

import { CheckIcon, ChevronDownIcon, HomeIcon, Loader2Icon } from "lucide-react";
import { useRouter } from "next/navigation";
import { useSession } from "next-auth/react";
import { useMemo, useTransition } from "react";

import { Button } from "@/components/ui/Button";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/DropdownMenu";
import { useToast } from "@/hooks/useToast";
import { trpc } from "@/lib/trpc/react";

export const Switcher = () => {
	const [isPending, startTransition] = useTransition();
	const { toast } = useToast();
	const router = useRouter();
	const { status, update } = useSession();

	const { data, isLoading } = trpc.households.list.useQuery(undefined, {
		enabled: status === "authenticated",
	});

	const households = data?.households ?? [];
	const activeHouseholdId = data?.activeHouseholdId ?? null;

	const activeHousehold = useMemo(
		() => households.find((household) => household.id === activeHouseholdId) ?? households[0] ?? null,
		[households, activeHouseholdId],
	);

	const selectMutation = trpc.households.select.useMutation({
		onSuccess: async () => {
			await update();
			router.refresh();
		},
		onError: (error) => {
			toast({
				title: "Unable to switch households",
				description: error.message ?? "Please try again.",
				variant: "destructive",
			});
		},
	});

	const handleSelect = (householdId: string) => {
		if (householdId === activeHouseholdId || isPending) {
			return;
		}

		startTransition(async () => {
			await selectMutation.mutateAsync({ householdId });
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
					households.map((household) => (
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
