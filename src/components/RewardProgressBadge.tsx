"use client";

import { GiftIcon, LockIcon } from "lucide-react";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";

import { useTranslation } from "@/lib/i18nClient";
import { getRewardBadgeState } from "@/lib/rewardBadge";
import { cn } from "@/lib/utils";

type Props = {
	householdId: string;
	points: number;
	threshold: number;
	claimsRemaining: number | null;
	progressBarColor?: string | null;
	/** Hide the threshold on the narrowest phones, where a three-tab row is crowded. */
	compact?: boolean;
	className?: string;
};

const RING_RADIUS = 8;
const RING_CIRCUMFERENCE = 2 * Math.PI * RING_RADIUS;
// Rounded percentages can reach 100 just below the threshold; keep a visible gap until a reward is ready.
const MAX_PROGRESS_RING = 92;
const DELTA_VISIBLE_MS = 2500;

// Remembers the last balance so a gain (own completion or a live approval) flashes "+N" briefly.
const usePointsGain = (points: number) => {
	const previous = useRef(points);
	const [gain, setGain] = useState(0);
	useEffect(() => {
		const gained = points - previous.current;
		previous.current = points;
		setGain(Math.max(0, gained));
		if (gained <= 0) return;
		const timer = setTimeout(() => setGain(0), DELTA_VISIBLE_MS);
		return () => clearTimeout(timer);
	}, [points]);
	return gain;
};

export const RewardProgressBadge = ({
	householdId,
	points,
	threshold,
	claimsRemaining,
	progressBarColor,
	compact = false,
	className,
}: Props) => {
	const { t, i18n } = useTranslation();
	const state = getRewardBadgeState({ points, threshold, claimsRemaining });
	const gain = usePointsGain(points);
	// Format with the app language so server and client render the same digits.
	const format = (value: number) => value.toLocaleString(i18n.resolvedLanguage);

	const label =
		state.kind === "ready"
			? state.count === 1
				? t("Reward ready")
				: t("{{count}} rewards ready", { count: state.count })
			: state.kind === "limited"
				? t("{{points}} pts, claiming is paused", { points: format(points) })
				: // Starts with the visible "38 / 50" so voice control can target it by what it shows.
					t("{{points}} / {{threshold}} points towards your next reward", {
						points: format(points),
						threshold: format(threshold),
					});

	return (
		<Link
			href={`/${householdId}#points`}
			aria-label={label}
			title={label}
			className={cn(
				"inline-flex h-9 shrink-0 items-center gap-1.5 whitespace-nowrap rounded-full border pl-1.5 pr-3 text-sm font-medium tabular-nums transition-[background-color,border-color,box-shadow] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
				state.kind === "ready"
					? "border-emerald-500/40 bg-emerald-500/10 pl-2.5 text-emerald-700 hover:bg-emerald-500/15 dark:text-emerald-400"
					: "border-border/80 bg-card hover:bg-accent",
				gain > 0 ? "border-emerald-500/50 shadow-[0_0_0_3px_rgb(16_185_129/0.2)]" : null,
				className,
			)}
		>
			{state.kind === "ready" ? (
				<>
					<GiftIcon aria-hidden="true" className="h-4 w-4" />
					<span>{label}</span>
				</>
			) : state.kind === "limited" ? (
				<>
					<LockIcon aria-hidden="true" className="ml-1 h-3.5 w-3.5 text-muted-foreground" />
					<span>{t("{{points}} pts", { points: format(points) })}</span>
				</>
			) : (
				<>
					<svg aria-hidden="true" width="22" height="22" viewBox="0 0 22 22" className="-rotate-90">
						<circle cx="11" cy="11" r={RING_RADIUS} fill="none" strokeWidth="3" className="stroke-primary/20" />
						<circle
							cx="11"
							cy="11"
							r={RING_RADIUS}
							fill="none"
							strokeWidth="3"
							strokeDasharray={RING_CIRCUMFERENCE}
							strokeDashoffset={RING_CIRCUMFERENCE * (1 - Math.min(state.progress, MAX_PROGRESS_RING) / 100)}
							className="stroke-primary motion-safe:transition-[stroke-dashoffset] motion-safe:duration-700"
							style={progressBarColor ? { stroke: progressBarColor } : undefined}
						/>
					</svg>
					<span aria-hidden="true">
						{format(points)}
						<span className={cn("font-normal text-muted-foreground", compact ? "max-[389px]:hidden" : null)}>
							{` / ${format(threshold)}`}
						</span>
					</span>
				</>
			)}
			{gain > 0 ? (
				<span
					aria-hidden="true"
					className="text-xs font-semibold text-emerald-600 motion-safe:animate-in motion-safe:fade-in dark:text-emerald-400"
				>
					{`+${format(gain)}`}
				</span>
			) : null}
		</Link>
	);
};
