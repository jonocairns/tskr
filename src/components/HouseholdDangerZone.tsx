"use client";

import { useRouter } from "next/navigation";
import { useTransition } from "react";

import {
	AlertDialog,
	AlertDialogAction,
	AlertDialogCancel,
	AlertDialogContent,
	AlertDialogDescription,
	AlertDialogFooter,
	AlertDialogHeader,
	AlertDialogTitle,
	AlertDialogTrigger,
} from "@/components/ui/AlertDialog";
import { Button } from "@/components/ui/Button";
import {
	Card,
	CardContent,
	CardDescription,
	CardHeader,
	CardTitle,
} from "@/components/ui/Card";
import { useToast } from "@/hooks/use-toast";

type Props = {
	canDelete: boolean;
	variant?: "card" | "section";
};

export const HouseholdDangerZone = ({ canDelete, variant = "card" }: Props) => {
	const [isPending, startTransition] = useTransition();
	const { toast } = useToast();
	const router = useRouter();
	const isSection = variant === "section";

	if (!canDelete) {
		return null;
	}

	const handleDelete = () => {
		startTransition(async () => {
			const res = await fetch("/api/households/current", {
				method: "DELETE",
			});

			if (!res.ok) {
				const body = await res.json().catch(() => ({}));
				toast({
					title: "Unable to delete household",
					description: body?.error ?? "Please try again.",
					variant: "destructive",
				});
				return;
			}

			toast({ title: "Household deleted" });
			router.push("/landing");
		});
	};

	const header = (
		<div className={isSection ? "space-y-1" : undefined}>
			<CardTitle className={isSection ? "text-base" : "text-xl"}>
				Danger zone
			</CardTitle>
			<CardDescription>
				Deleting a household removes all members, tasks, and history.
			</CardDescription>
		</div>
	);

	const content = (
		<AlertDialog>
			<AlertDialogTrigger asChild>
				<Button type="button" variant="destructive" disabled={isPending}>
					Delete household
				</Button>
			</AlertDialogTrigger>
			<AlertDialogContent>
				<AlertDialogHeader>
					<AlertDialogTitle>Delete household?</AlertDialogTitle>
					<AlertDialogDescription>
						This action cannot be undone. All members and history will be
						removed.
					</AlertDialogDescription>
				</AlertDialogHeader>
				<AlertDialogFooter>
					<AlertDialogCancel>Cancel</AlertDialogCancel>
					<AlertDialogAction
						type="button"
						onClick={handleDelete}
						className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
					>
						Delete
					</AlertDialogAction>
				</AlertDialogFooter>
			</AlertDialogContent>
		</AlertDialog>
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
		<Card>
			<CardHeader>{header}</CardHeader>
			<CardContent>{content}</CardContent>
		</Card>
	);
};
