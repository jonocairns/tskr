import { redirect } from "next/navigation";

import { getHouseholdContext } from "@/lib/serverAuth";
import { buildTasksHref } from "@/lib/tasks/href";

export const dynamic = "force-dynamic";

type Props = {
	params: Promise<{ householdId: string }>;
};

const AssignmentsPage = async ({ params }: Props) => {
	const { householdId } = await params;
	const { membership } = await getHouseholdContext(householdId);
	redirect(buildTasksHref(householdId, { tab: membership.role === "DOER" ? "todo" : "manage" }));
};

export default AssignmentsPage;
