"use client";

import {
	CheckIcon,
	ChevronDownIcon,
	HomeIcon,
	Loader2Icon,
} from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState, useTransition } from "react";

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

type Household = {
	id: string;
	name: string;
	role: "DICTATOR" | "APPROVER" | "DOER";
};

export const Switcher = () => {
	const [households, setHouseholds] = useState<Household[]>([]);
	const [activeHouseholdId, setActiveHouseholdId] = useState<string | null>(
		null,
	);
	const [isLoading, setIsLoading] = useState(true);
	const [isPending, startTransition] = useTransition();
	const { toast } = useToast();
	const router = useRouter();

	useEffect(() => {
		let isActive = true;

		const load = async () => {
			try {
				const res = await fetch("/api/households");
				if (!res.ok) {
					throw new Error("Failed to load households");
				}
				const data = await res.json().catch(() => ({}));
				if (!isActive) {
					return;
				}
				setHouseholds(Array.isArray(data?.households) ? data.households : []);
				setActiveHouseholdId(
					typeof data?.activeHouseholdId === "string"
						? data.activeHouseholdId
						: null,
				);
			} catch (error) {
				if (isActive) {
					toast({
						title: "Unable to load households",
						description: "Please refresh and try again.",
						variant: "destructive",
					});
				}
			} finally {
				if (isActive) {
					setIsLoading(false);
				}
			}
		};

		load();

		return () => {
			isActive = false;
		};
	}, [toast]);

	const activeHousehold = useMemo(
		() =>
			households.find((household) => household.id === activeHouseholdId) ??
			households[0] ??
			null,
		[households, activeHouseholdId],
	);

	const handleSelect = (householdId: string) => {
		if (householdId === activeHouseholdId || isPending) {
			return;
		}

		startTransition(async () => {
			const res = await fetch("/api/households/select", {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({ householdId }),
			});

			if (!res.ok) {
				const body = await res.json().catch(() => ({}));
				toast({
					title: "Unable to switch households",
					description: body?.error ?? "Please try again.",
					variant: "destructive",
				});
				return;
			}

			setActiveHouseholdId(householdId);
			router.refresh();
		});
	};

	const hasMultipleHouseholds = households.length > 1;

	const buttonContent = (
		<>
			{isLoading ? (
				<Loader2Icon className="h-4 w-4 animate-spin" />
			) : (
				<HomeIcon className="h-4 w-4" />
			)}
			<span className="max-w-[140px] truncate text-left">
				{activeHousehold?.name ?? "Household"}
			</span>
			{hasMultipleHouseholds ? (
				<ChevronDownIcon className="h-4 w-4 text-muted-foreground" />
			) : null}
		</>
	);

	if (!hasMultipleHouseholds) {
		return null;
	}

	return (
		<DropdownMenu>
			<DropdownMenuTrigger asChild>
				<Button
					type="button"
					variant="outline"
					size="sm"
					className="gap-2 p-2"
					disabled={isLoading}
				>
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
							{household.id === activeHouseholdId ? (
								<CheckIcon className="h-4 w-4 text-primary" />
							) : null}
						</DropdownMenuItem>
					))
				)}
			</DropdownMenuContent>
		</DropdownMenu>
	);
};
