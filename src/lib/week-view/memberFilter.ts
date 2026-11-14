export const getWeekViewMemberCookieName = (householdId: string) => `tskr-week-member-${householdId}`;

export const resolveWeekViewMember = ({
	query,
	cookie,
	memberIds,
}: {
	query?: string | null;
	cookie?: string | null;
	memberIds: string[];
}) => {
	const isValid = (value: string | null | undefined) => !!value && (value === "all" || memberIds.includes(value));
	if (query && isValid(query)) return query;
	if (cookie && isValid(cookie)) return cookie;
	return "all";
};
