"use client";

import { useRouter } from "next/navigation";
import { useEffect, useRef } from "react";

type Props = {
	householdId: string;
	enabled?: boolean;
	debounceMs?: number;
};

export const LiveRefresh = ({ householdId, enabled = true, debounceMs = 300 }: Props) => {
	const router = useRouter();
	const refreshTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

	useEffect(() => {
		if (!enabled) {
			return undefined;
		}

		const streamUrl = `/api/stream?householdId=${encodeURIComponent(householdId)}`;
		const source = new EventSource(streamUrl);

		const scheduleRefresh = () => {
			if (refreshTimerRef.current) {
				return;
			}

			refreshTimerRef.current = setTimeout(() => {
				refreshTimerRef.current = null;
				router.refresh();
			}, debounceMs);
		};

		source.addEventListener("dashboard", scheduleRefresh);

		return () => {
			source.close();
			if (refreshTimerRef.current) {
				clearTimeout(refreshTimerRef.current);
				refreshTimerRef.current = null;
			}
		};
	}, [debounceMs, enabled, router, householdId]);

	return null;
};
