import { redirect } from "next/navigation";

import { legacyWeekRedirectHref, type TasksSearchParams } from "@/lib/tasks/href";

export const dynamic = "force-dynamic";

const WeekViewPage = async ({
	params,
	searchParams,
}: {
	params: Promise<{ householdId: string }>;
	searchParams?: Promise<TasksSearchParams>;
}) => {
	const { householdId } = await params;
	redirect(legacyWeekRedirectHref(householdId, searchParams ? await searchParams : {}));
};

export default WeekViewPage;
