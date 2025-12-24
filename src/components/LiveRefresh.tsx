"use client";

import { useRouter } from "next/navigation";
import { useEffect, useRef } from "react";

type Props = {
	enabled?: boolean;
	debounceMs?: number;
};

export const LiveRefresh = ({ enabled = true, debounceMs = 300 }: Props) => {
	const router = useRouter();
	const refreshTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

	useEffect(() => {
		if (!enabled) {
			return undefined;
		}

		const source = new EventSource("/api/stream");

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
	}, [debounceMs, enabled, router]);

	return null;
};
