import { useEffect, useState } from "react";

import { type DateFormat, formatRelativeWhen, type TimeFormat } from "@/lib/formatDate";
import { useTranslation } from "@/lib/i18nClient";
import { getTimeZoneCity, resolveTimeZone } from "@/lib/timeZones";

type Options = {
	timeZone: string;
	dateFormat: DateFormat;
	timeFormat: TimeFormat;
};

// Returns a formatter for "tomorrow" / "today at 14:01 (Auckland time)" phrases. The zone hint only
// appears with a time, and only for viewers whose browser sits in another zone. The browser zone is read
// after mount so server and client render the same markup.
export const useRelativeWhen = ({ timeZone, dateFormat, timeFormat }: Options) => {
	const { t } = useTranslation();
	const [viewerTimeZone, setViewerTimeZone] = useState<string | null>(null);
	const householdTimeZone = resolveTimeZone(timeZone);

	useEffect(() => {
		setViewerTimeZone(Intl.DateTimeFormat().resolvedOptions().timeZone ?? null);
	}, []);

	return (value: string | Date) => {
		const { text, hasTime } = formatRelativeWhen(value, { t, timeZone: householdTimeZone, dateFormat, timeFormat });
		if (!hasTime || !viewerTimeZone || viewerTimeZone === householdTimeZone) return text;
		return `${text} ${t("({{city}} time)", { city: getTimeZoneCity(householdTimeZone) })}`;
	};
};
