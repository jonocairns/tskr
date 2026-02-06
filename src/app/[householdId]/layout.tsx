import type { Metadata } from "next";

import { prisma } from "@/lib/prisma";
import { getHouseholdContext } from "@/lib/serverAuth";

type HouseholdLayoutProps = {
	children: React.ReactNode;
	params?: { householdId?: string } | Promise<{ householdId?: string }>;
};

export const generateMetadata = async ({ params }: Pick<HouseholdLayoutProps, "params">): Promise<Metadata> => {
	const resolvedParams = await params;
	const householdId = resolvedParams?.householdId;

	if (!householdId) {
		return { title: "tskr" };
	}

	await getHouseholdContext(householdId);

	const household = await prisma.household.findUnique({
		where: { id: householdId },
		select: { name: true },
	});

	const name = household?.name?.trim();

	return {
		title: name ? `tskr - ${name}` : "tskr",
	};
};

const HouseholdLayout = ({ children }: HouseholdLayoutProps) => {
	return <>{children}</>;
};

export default HouseholdLayout;
