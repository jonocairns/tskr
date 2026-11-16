"use client";

import {
	AlertDialog,
	AlertDialogAction,
	AlertDialogCancel,
	AlertDialogContent,
	AlertDialogDescription,
	AlertDialogFooter,
	AlertDialogHeader,
	AlertDialogTitle,
} from "@/components/ui/AlertDialog";
import { Button } from "@/components/ui/Button";
import { useTranslation } from "@/lib/i18nClient";

export const CountTowardsDialog = ({
	task,
	disabled,
	onCancel,
	onCount,
	onExtra,
}: {
	task: { label: string; assigneeName: string | null } | null;
	disabled: boolean;
	onCancel: () => void;
	onCount: () => void;
	onExtra: () => void;
}) => {
	const { t } = useTranslation();
	const params = { task: task?.label ?? "", name: task?.assigneeName ?? t("Someone") };
	return (
		<AlertDialog
			open={!!task}
			onOpenChange={(open) => {
				if (!open && !disabled) onCancel();
			}}
		>
			<AlertDialogContent>
				<AlertDialogHeader>
					<AlertDialogTitle>{t("Count towards {{name}}'s {{task}}?", params)}</AlertDialogTitle>
					<AlertDialogDescription>
						{t("{{task}} is assigned to {{name}}. You will receive the points either way.", params)}
					</AlertDialogDescription>
				</AlertDialogHeader>
				<AlertDialogFooter>
					<AlertDialogCancel disabled={disabled}>{t("Cancel")}</AlertDialogCancel>
					<Button variant="outline" disabled={disabled} onClick={onExtra}>
						{t("Log as extra")}
					</Button>
					<AlertDialogAction
						disabled={disabled}
						onClick={(event) => {
							event.preventDefault();
							onCount();
						}}
					>
						{t("Count towards it")}
					</AlertDialogAction>
				</AlertDialogFooter>
			</AlertDialogContent>
		</AlertDialog>
	);
};
