"use client";

import { PlusIcon } from "lucide-react";
import Link from "next/link";

import { type AssignedTaskEntry, AssignedTaskTable } from "@/components/AssignedTaskTable";
import { Button } from "@/components/ui/Button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/Card";
import type { DateFormat, TimeFormat } from "@/lib/formatDate";
import { useTranslation } from "@/lib/i18nClient";
import { buildTasksHref } from "@/lib/tasks/href";

export type { AssignedTaskEntry } from "@/components/AssignedTaskTable";

type Props = {
	householdId: string;
	entries: AssignedTaskEntry[];
	doneThisWeek: number;
	timeZone: string;
	dateFormat: DateFormat;
	timeFormat: TimeFormat;
	canManageTasks?: boolean;
};

export const AssignedTaskQueue = ({ doneThisWeek, canManageTasks = false, ...tableProps }: Props) => {
	const { t } = useTranslation();
	const { householdId } = tableProps;
	return (
		<Card>
			<CardHeader className="flex flex-row items-start justify-between gap-4 space-y-0">
				<div className="space-y-1.5">
					<CardTitle className="text-xl">{t("To do")}</CardTitle>
					<CardDescription>{t("Anyone in the household can complete these tasks.")}</CardDescription>
				</div>
				{canManageTasks ? (
					<Button asChild variant="outline" size="sm" className="shrink-0">
						<Link href={`/${householdId}/assignments`}>
							<PlusIcon />
							{t("Add task")}
						</Link>
					</Button>
				) : null}
			</CardHeader>
			<CardContent className="space-y-4">
				<AssignedTaskTable {...tableProps} />
				<div className="flex flex-wrap justify-between gap-3 text-sm font-medium underline underline-offset-4">
					<Link href={buildTasksHref(householdId, { tab: "todo", userId: "all" })}>{t("All tasks →")}</Link>
					{doneThisWeek > 0 ? (
						<Link href={buildTasksHref(householdId, { tab: "done", preset: "calendarWeek", userId: "all" })}>
							{t("{{count}} done this week →", { count: doneThisWeek })}
						</Link>
					) : null}
				</div>
			</CardContent>
		</Card>
	);
};
