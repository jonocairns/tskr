"use client";

import { type ReactNode, useState } from "react";

import { useTaskActions } from "@/components/task-actions/Context";
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
import { useTranslation } from "@/lib/i18nClient";
import { trpc } from "@/lib/trpc/react";

type Props = {
	presetId: string;
	label: string;
	onDelete: () => void;
	children: ReactNode;
};

export const PresetDeleteDialog = ({ presetId, label, onDelete, children }: Props) => {
	const { householdId, currentUserRole } = useTaskActions();
	const { t } = useTranslation();
	const [open, setOpen] = useState(false);
	const isApprover = currentUserRole !== "DOER";
	const usage = trpc.presets.usage.useQuery({ householdId, id: presetId }, { enabled: open && isApprover });
	const taskLabels = usage.data?.tasks.map((task) =>
		t("{{task}} ({{assignee}})", {
			task: task.preset.label,
			assignee: task.assignedTo ? (task.assignedTo.name ?? task.assignedTo.email ?? t("Unknown")) : t("Open"),
		}),
	);

	return (
		<AlertDialog open={open} onOpenChange={setOpen}>
			<AlertDialogTrigger asChild>{children}</AlertDialogTrigger>
			<AlertDialogContent>
				<AlertDialogHeader>
					<AlertDialogTitle>
						{taskLabels?.length ? t("Delete from Quick log and the task list?") : t("Delete from Quick log?")}
					</AlertDialogTitle>
					<AlertDialogDescription>
						{t('"{{label}}" will be removed from Quick log. Completions already logged stay in Done.', { label })}
						{isApprover && usage.isFetching ? <span className="mt-2 block">{t("Loading tasks…")}</span> : null}
						{isApprover && usage.isError ? <span className="mt-2 block">{t("Unable to load tasks.")}</span> : null}
						{taskLabels?.length ? (
							<span className="mt-2 block">
								{t("Tasks using it are removed from the list: {{tasks}}", { tasks: taskLabels.join(", ") })}
							</span>
						) : null}
					</AlertDialogDescription>
				</AlertDialogHeader>
				<AlertDialogFooter>
					<AlertDialogCancel>{t("Cancel")}</AlertDialogCancel>
					{isApprover && usage.isError ? (
						<Button variant="outline" onClick={() => void usage.refetch()}>
							{t("Retry")}
						</Button>
					) : null}
					<AlertDialogAction
						type="button"
						disabled={isApprover && (usage.isPending || usage.isFetching || usage.isError)}
						onClick={onDelete}
						className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
					>
						{t("Delete")}
					</AlertDialogAction>
				</AlertDialogFooter>
			</AlertDialogContent>
		</AlertDialog>
	);
};
