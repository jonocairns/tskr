"use client";

import { GiftIcon, LockIcon } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
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
	/**
	 * When a claim limit next changes. Pages without the dashboard's points card pass it so the
	 * badge leaves its paused state on time; the dashboard card already refreshes itself.
	 */
	refreshAt?: string | null;
	/** Hide the threshold on narrow phones, where a three-tab row is crowded. */
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
	refreshAt = null,
	className,
}: Props) => {
	const router = useRouter();
	const { t, i18n } = useTranslation();
	const state = getRewardBadgeState({ points, threshold, claimsRemaining });
	const gain = usePointsGain(points);

	useEffect(() => {
		if (!refreshAt) return;
		// Clamp to setTimeout's 32-bit limit, as PointsSummary does.
		const delay = Math.min(2_147_483_647, Math.max(0, Date.parse(refreshAt) - Date.now()) + 100);
		const timer = setTimeout(() => router.refresh(), delay);
		return () => clearTimeout(timer);
	}, [refreshAt, router]);
	// Format with the app language so server and client render the same digits.
	const format = (value: number) => value.toLocaleString(i18n.resolvedLanguage);

	const meter = { points: format(state.meterPoints), threshold: format(threshold) };
	// Each label starts with or contains the visible numbers so voice control can target the badge by what it shows.
	const label =
		state.kind === "ready"
			? state.count === 1
				? t("Reward ready, {{points}} / {{threshold}} points towards another reward", meter)
				: t("{{count}} rewards ready, {{points}} / {{threshold}} points towards another reward", {
						count: state.count,
						points: meter.points,
						threshold: meter.threshold,
					})
			: state.kind === "limited"
				? t("Claiming is paused, {{points}} / {{threshold}} points towards another reward", meter)
				: t("{{points}} / {{threshold}} points towards your next reward", meter);

	return (
		<Link
			href={`/${householdId}#points`}
			aria-label={label}
			title={label}
			className={cn(
				"inline-flex h-9 shrink-0 items-center gap-1.5 whitespace-nowrap rounded-full border pr-3 text-sm font-medium tabular-nums transition-[background-color,border-color,box-shadow] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
				state.kind === "progress" ? "pl-1.5" : "pl-2.5",
				state.kind === "ready"
					? "border-emerald-500/40 bg-emerald-500/10 text-emerald-700 hover:bg-emerald-500/15 dark:text-emerald-400"
					: "border-border/80 bg-card hover:bg-accent",
				gain > 0 ? "border-emerald-500/50 shadow-[0_0_0_3px_rgb(16_185_129/0.2)]" : null,
				className,
			)}
		>
			{state.kind === "ready" ? (
				<span aria-hidden="true" className="inline-flex items-center gap-0.5">
					<GiftIcon className="h-4 w-4" />
					{state.count > 1 ? <span className="text-xs font-semibold">{`×${format(state.count)}`}</span> : null}
				</span>
			) : state.kind === "limited" ? (
				<LockIcon aria-hidden="true" className="h-3.5 w-3.5 text-muted-foreground" />
			) : null}
			<svg aria-hidden="true" width="22" height="22" viewBox="0 0 22 22" className="-rotate-90">
				<circle
					cx="11"
					cy="11"
					r={RING_RADIUS}
					fill="none"
					strokeWidth="3"
					className={state.kind === "ready" ? "stroke-emerald-600/20" : "stroke-primary/20"}
				/>
				<circle
					cx="11"
					cy="11"
					r={RING_RADIUS}
					fill="none"
					strokeWidth="3"
					strokeDasharray={RING_CIRCUMFERENCE}
					strokeDashoffset={RING_CIRCUMFERENCE * (1 - Math.min(state.progress, MAX_PROGRESS_RING) / 100)}
					className={cn(
						"motion-safe:transition-[stroke-dashoffset] motion-safe:duration-700",
						state.kind === "ready"
							? "stroke-emerald-600 dark:stroke-emerald-400"
							: state.kind === "limited"
								? "stroke-muted-foreground"
								: "stroke-primary",
					)}
					// Ready and paused keep their state colours; only plain progress takes the household colour.
					style={state.kind === "progress" && progressBarColor ? { stroke: progressBarColor } : undefined}
				/>
			</svg>
			<span aria-hidden="true">
				{meter.points}
				<span
					className={cn(
						"font-normal",
						state.kind === "ready" ? null : "text-muted-foreground",
						// Ready and paused badges carry an icon too, so they need the room on slightly wider phones.
						compact ? (state.kind === "progress" ? "max-[389px]:hidden" : "max-[429px]:hidden") : null,
					)}
				>
					{` / ${meter.threshold}`}
				</span>
			</span>
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
