"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState, useTransition } from "react";

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

export const SettingsCard = ({ canManage, variant = "card" }: Props) => {
	const [name, setName] = useState("");
	const [initialName, setInitialName] = useState("");
	const [threshold, setThreshold] = useState("50");
	const [initialThreshold, setInitialThreshold] = useState(50);
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
				const fetchedThreshold =
					typeof data?.household?.rewardThreshold === "number"
						? data.household.rewardThreshold
						: 50;
				setName(fetchedName);
				setInitialName(fetchedName);
				setThreshold(String(fetchedThreshold));
				setInitialThreshold(fetchedThreshold);
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
	const parsedThreshold = Number(threshold);
	const thresholdValid =
		Number.isFinite(parsedThreshold) && parsedThreshold >= 1;
	const canSave = name.trim().length >= 2 && thresholdValid;
	const isFormDirty =
		isDirty || Math.floor(parsedThreshold) !== initialThreshold;

	const handleSave = () => {
		if (!canSave || !isFormDirty) {
			return;
		}

		startTransition(async () => {
			const res = await fetch("/api/households/current", {
				method: "PATCH",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({
					name: name.trim(),
					rewardThreshold: Math.floor(parsedThreshold),
				}),
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
			const updatedThreshold =
				typeof body?.household?.rewardThreshold === "number"
					? body.household.rewardThreshold
					: Math.floor(parsedThreshold);
			setName(updatedName);
			setInitialName(updatedName);
			setThreshold(String(updatedThreshold));
			setInitialThreshold(updatedThreshold);
			toast({ title: "Household updated" });
			router.refresh();
		});
	};

	const header = (
		<div className={isSection ? "space-y-1" : undefined}>
			<CardTitle className={isSection ? "text-base" : "text-xl"}>
				General
			</CardTitle>
			<CardDescription>Rename your household.</CardDescription>
		</div>
	);

	const content = (
		<div className="space-y-4">
			<div className="grid gap-4 sm:grid-cols-2">
				<div className="space-y-2">
					<Label htmlFor="household-name">Name</Label>
					<Input
						id="household-name"
						value={name}
						onChange={(event) => setName(event.target.value)}
						disabled={isLoading || isPending}
					/>
				</div>
				<div className="space-y-2">
					<Label htmlFor="household-threshold">Reward threshold</Label>
					<Input
						id="household-threshold"
						type="number"
						min={1}
						step={1}
						value={threshold}
						onChange={(event) => setThreshold(event.target.value)}
						disabled={isLoading || isPending}
					/>
				</div>
			</div>
			<Button
				type="button"
				onClick={handleSave}
				disabled={isLoading || isPending || !canSave || !isFormDirty}
			>
				Save changes
			</Button>
		</div>
	);

	if (isSection) {
		return <section className="space-y-3">{content}</section>;
	}

	return (
		<Card>
			<CardHeader>{header}</CardHeader>
			<CardContent>{content}</CardContent>
		</Card>
	);
};
