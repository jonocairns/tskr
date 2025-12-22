"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";

const MAX_PULL = 120;
const TRIGGER_PULL = 80;
const RESET_DELAY_MS = 1000;

const isIOSDevice = () => {
	if (typeof navigator === "undefined") {
		return false;
	}

	const userAgent = navigator.userAgent;
	const isIPhoneOrIPad = /iPad|iPhone|iPod/.test(userAgent);
	const isIPadDesktopMode =
		navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1;

	return isIPhoneOrIPad || isIPadDesktopMode;
};

const isStandaloneMode = () => {
	if (typeof window === "undefined") {
		return false;
	}

	const mediaStandalone = window.matchMedia?.("(display-mode: standalone)")
		?.matches;
	const nav = navigator as Navigator & { standalone?: boolean };
	const navigatorStandalone = Boolean(nav.standalone);

	return Boolean(mediaStandalone || navigatorStandalone);
};

export function PullToRefresh() {
	const router = useRouter();
	const [pullDistance, setPullDistance] = useState(0);
	const [armed, setArmed] = useState(false);
	const startYRef = useRef<number | null>(null);
	const distanceRef = useRef(0);
	const refreshingRef = useRef(false);
	const resetTimeoutRef = useRef<number | null>(null);

	useEffect(() => {
		if (!isIOSDevice() || !isStandaloneMode()) {
			return undefined;
		}

		const resetState = () => {
			distanceRef.current = 0;
			setPullDistance(0);
			setArmed(false);
		};

		const atTop = () => window.scrollY <= 0;

		const onTouchStart = (event: TouchEvent) => {
			if (refreshingRef.current || !atTop()) {
				return;
			}

			startYRef.current = event.touches[0]?.clientY ?? null;
			resetState();
		};

		const onTouchMove = (event: TouchEvent) => {
			if (startYRef.current === null || refreshingRef.current) {
				return;
			}

			const currentY = event.touches[0]?.clientY ?? 0;
			const delta = currentY - startYRef.current;

			if (delta <= 0) {
				return;
			}

			const nextDistance = Math.min(delta, MAX_PULL);
			distanceRef.current = nextDistance;
			setPullDistance(nextDistance);
			setArmed(nextDistance >= TRIGGER_PULL);
		};

		const onTouchEnd = () => {
			if (startYRef.current === null) {
				return;
			}

			startYRef.current = null;
			const shouldRefresh = distanceRef.current >= TRIGGER_PULL;
			resetState();

			if (shouldRefresh && !refreshingRef.current) {
				refreshingRef.current = true;
				router.refresh();
				resetTimeoutRef.current = window.setTimeout(() => {
					refreshingRef.current = false;
				}, RESET_DELAY_MS);
			}
		};

		window.addEventListener("touchstart", onTouchStart, { passive: true });
		window.addEventListener("touchmove", onTouchMove, { passive: true });
		window.addEventListener("touchend", onTouchEnd, { passive: true });
		window.addEventListener("touchcancel", onTouchEnd, { passive: true });

		return () => {
			window.removeEventListener("touchstart", onTouchStart);
			window.removeEventListener("touchmove", onTouchMove);
			window.removeEventListener("touchend", onTouchEnd);
			window.removeEventListener("touchcancel", onTouchEnd);

			if (resetTimeoutRef.current !== null) {
				window.clearTimeout(resetTimeoutRef.current);
			}
		};
	}, [router]);

	const visibleDistance = Math.min(pullDistance, 60);

	return (
		<div
			aria-hidden="true"
			className="pointer-events-none fixed inset-x-0 top-0 z-50 flex h-10 items-center justify-center text-xs font-semibold uppercase tracking-[0.2em] text-muted-foreground"
			style={{
				transform: `translateY(${visibleDistance - 60}px)`,
				opacity: pullDistance > 0 ? 1 : 0,
				transition:
					pullDistance === 0
						? "transform 200ms ease, opacity 200ms ease"
						: "none",
			}}
		>
			{armed ? "Release to refresh" : "Pull to refresh"}
		</div>
	);
}
