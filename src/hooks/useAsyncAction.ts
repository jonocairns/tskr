"use client";

import { useCallback, useRef, useState } from "react";

export const useAsyncAction = () => {
	const [isPending, setIsPending] = useState(false);
	const isPendingRef = useRef(false);

	const run = useCallback(async <T>(action: () => Promise<T>) => {
		if (isPendingRef.current) {
			return null;
		}

		isPendingRef.current = true;
		setIsPending(true);
		try {
			return await action();
		} finally {
			isPendingRef.current = false;
			setIsPending(false);
		}
	}, []);

	const reset = useCallback(() => {
		isPendingRef.current = false;
		setIsPending(false);
	}, []);

	return {
		isPending,
		run,
		reset,
	};
};
