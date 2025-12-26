"use client";

import { useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";

import { Button } from "@/components/ui/Button";
import {
	Card,
	CardContent,
	CardDescription,
	CardHeader,
	CardTitle,
} from "@/components/ui/Card";
import { Input } from "@/components/ui/Input";
import { Label } from "@/components/ui/Label";
import { useToast } from "@/hooks/use-toast";

type Props = {
	householdId: string;
	canManage: boolean;
	variant?: "card" | "section";
};

export const HouseholdSettingsCard = ({
	canManage,
	variant = "card",
}: Props) => {
	const [name, setName] = useState("");
	const [initialName, setInitialName] = useState("");
	const [isLoading, setIsLoading] = useState(true);
	const [isPending, startTransition] = useTransition();
	const { toast } = useToast();
	const router = useRouter();
	const isSection = variant === "section";

	useEffect(() => {
		if (!canManage) {
			return;
		}

		let isActive = true;

		const load = async () => {
			setIsLoading(true);
			try {
				const res = await fetch("/api/households/current");
				if (!res.ok) {
					throw new Error("Failed to load household");
				}
				const data = await res.json().catch(() => ({}));
				if (!isActive) {
					return;
				}
				const fetchedName =
					typeof data?.household?.name === "string" ? data.household.name : "";
				setName(fetchedName);
				setInitialName(fetchedName);
			} catch (error) {
				if (isActive) {
					toast({
						title: "Unable to load household settings",
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
	}, [canManage, toast]);

	if (!canManage) {
		return null;
	}

	const isDirty = name.trim() !== initialName.trim();
	const canSave = name.trim().length >= 2;

	const handleSave = () => {
		if (!canSave || !isDirty) {
			return;
		}

		startTransition(async () => {
			const res = await fetch("/api/households/current", {
				method: "PATCH",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({ name: name.trim() }),
			});

			if (!res.ok) {
				const body = await res.json().catch(() => ({}));
				toast({
					title: "Unable to update household",
					description: body?.error ?? "Please try again.",
					variant: "destructive",
				});
				return;
			}

			const body = await res.json().catch(() => ({}));
			const updatedName =
				typeof body?.household?.name === "string"
					? body.household.name
					: name.trim();
			setName(updatedName);
			setInitialName(updatedName);
			toast({ title: "Household updated" });
			router.refresh();
		});
	};

	const header = (
		<div className={isSection ? "space-y-1" : undefined}>
			<CardTitle className={isSection ? "text-base" : "text-xl"}>
				Household settings
			</CardTitle>
			<CardDescription>Rename your household.</CardDescription>
		</div>
	);

	const content = (
		<div className="space-y-4">
			<div className="space-y-2">
				<Label htmlFor="household-name">Name</Label>
				<Input
					id="household-name"
					value={name}
					onChange={(event) => setName(event.target.value)}
					disabled={isLoading || isPending}
				/>
			</div>
			<Button
				type="button"
				onClick={handleSave}
				disabled={isLoading || isPending || !canSave || !isDirty}
			>
				Save changes
			</Button>
		</div>
	);

	if (isSection) {
		return (
			<section className="space-y-3">
				{header}
				{content}
			</section>
		);
	}

	return (
		<Card className="mt-4">
			<CardHeader>{header}</CardHeader>
			<CardContent>{content}</CardContent>
		</Card>
	);
};
