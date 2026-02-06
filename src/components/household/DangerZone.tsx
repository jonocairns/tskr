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
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/Card";
import { useToast } from "@/hooks/useToast";
import { useTranslation } from "@/lib/i18nClient";
import { trpc } from "@/lib/trpc/react";

type Props = {
	householdId: string;
	canDelete: boolean;
	variant?: "card" | "section";
	showTitle?: boolean;
};

export const DangerZone = ({ householdId, canDelete, variant = "card", showTitle = false }: Props) => {
	const [isPending, startTransition] = useTransition();
	const { toast } = useToast();
	const { t } = useTranslation();
	const router = useRouter();
	const isSection = variant === "section";

	const deleteMutation = trpc.households.deleteCurrent.useMutation({
		onSuccess: () => {
			toast({ title: t("Household deleted") });
			router.push("/landing");
		},
		onError: (error) => {
			toast({
				title: t("Unable to delete household"),
				description: error.message ?? t("Please try again."),
				variant: "destructive",
			});
		},
	});

	if (!canDelete) {
		return null;
	}

	const handleDelete = () => {
		startTransition(async () => {
			await deleteMutation.mutateAsync({ householdId });
		});
	};

	const header = (
		<div className={isSection ? "space-y-1" : undefined}>
			<CardTitle className={isSection ? "text-base" : "text-xl"}>{t("Danger zone")}</CardTitle>
			<CardDescription>{t("Manage irreversible actions for this household.")}</CardDescription>
		</div>
	);

	const content = (
		<AlertDialog>
			<div className="flex flex-wrap items-center justify-between gap-3 rounded-md border border-destructive/30 bg-destructive/5 p-4">
				<div>
					<p className="text-sm font-semibold text-destructive">{t("Delete household")}</p>
					<p className="text-xs text-muted-foreground">{t("This removes all members, tasks, and history.")}</p>
				</div>
				<AlertDialogTrigger asChild>
					<Button type="button" variant="destructive" size="default" disabled={isPending}>
						{t("Delete")}
					</Button>
				</AlertDialogTrigger>
			</div>
			<AlertDialogContent>
				<AlertDialogHeader>
					<AlertDialogTitle>{t("Delete household?")}</AlertDialogTitle>
					<AlertDialogDescription>
						{t("This action cannot be undone. All members and history will be removed.")}
					</AlertDialogDescription>
				</AlertDialogHeader>
				<AlertDialogFooter>
					<AlertDialogCancel>{t("Cancel")}</AlertDialogCancel>
					<AlertDialogAction
						type="button"
						onClick={handleDelete}
						disabled={isPending}
						className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
					>
						{isPending ? t("Deleting...") : t("Delete")}
					</AlertDialogAction>
				</AlertDialogFooter>
			</AlertDialogContent>
		</AlertDialog>
	);

	if (isSection) {
		return (
			<section className="space-y-3">
				{showTitle ? header : null}
				{content}
			</section>
		);
	}

	return (
		<Card>
			{showTitle ? <CardHeader>{header}</CardHeader> : null}
			<CardContent>{content}</CardContent>
		</Card>
	);
};
