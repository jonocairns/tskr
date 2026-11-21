"use client";

import { CheckCircle2Icon, ChevronDownIcon, LockIcon, TrophyIcon } from "lucide-react";
import { useRouter } from "next/navigation";
import { type CSSProperties, type ReactNode, useEffect, useId, useState, useTransition } from "react";

import { Button } from "@/components/ui/Button";
import { CardContent, CardHeader, CardTitle } from "@/components/ui/Card";
import { DashboardCard } from "@/components/ui/DashboardCard";
import { Progress } from "@/components/ui/Progress";
import { useRelativeWhen } from "@/hooks/useRelativeWhen";
import { useToast } from "@/hooks/useToast";
import { type DateFormat, formatDate, type TimeFormat } from "@/lib/formatDate";
import { useTranslation } from "@/lib/i18nClient";
import {
	getBarEdgeColors,
	getClaimStatus,
	getPointsSummaryMetrics,
	getRulePlacement,
	SUBDUED_FILL_ALPHA,
} from "@/lib/pointsSummary";
import type { getRewardClaimAllowance } from "@/lib/rewardClaimLimits";
import { getTimeZoneDayNumber, resolveTimeZone } from "@/lib/timeZones";
import { trpc } from "@/lib/trpc/react";
import { cn } from "@/lib/utils";

type Allowance = Awaited<ReturnType<typeof getRewardClaimAllowance>>;
type Rule = NonNullable<Allowance>["rules"][number];
type Translate = (key: string, options?: Record<string, unknown>) => string;

type Props = {
	householdId: string;
	points: number;
	threshold: number;
	rewardClaimAllowance: Allowance;
	progressBarColor?: string | null;
	tasksLastWeek: number;
	pointsLastWeek: number;
	lastTaskAt: string | null;
	currentStreak: number;
	hasPendingTasks: boolean;
	timeZone: string;
	dateFormat: DateFormat;
	timeFormat: TimeFormat;
};

// The dashboard's Quick log card carries this id so new users can jump straight to it.
export const QUICK_LOG_ANCHOR = "quick-log";

export const PointsSummary = ({
	householdId,
	points,
	threshold,
	rewardClaimAllowance,
	progressBarColor,
	tasksLastWeek,
	pointsLastWeek,
	lastTaskAt,
	currentStreak,
	hasPendingTasks,
	timeZone,
	dateFormat,
	timeFormat,
}: Props) => {
	const [isPending, startTransition] = useTransition();
	const [limitsOpen, setLimitsOpen] = useState(false);
	const limitsId = useId();
	const router = useRouter();
	const { toast } = useToast();
	const { t, i18n } = useTranslation();

	const {
		pointsToGo,
		rewardsAvailable,
		carryoverPoints,
		nextRewardPointsToGo,
		canClaim: hasEnoughPoints,
		showCarryover,
	} = getPointsSummaryMetrics({ points, threshold });
	const { limitReached, resumesAt, claimableRewards, blockingRuleIds, limitingRuleId } = getClaimStatus({
		rewardsAvailable,
		allowance: rewardClaimAllowance,
	});
	// Settings reject non-positive thresholds; never offer a free claim if one slips through.
	const canClaim = hasEnoughPoints && !limitReached && threshold > 0;
	const isPaused = hasEnoughPoints && limitReached;
	const isBlockedBelow = !hasEnoughPoints && limitReached;
	const resolvedTimeZone = resolveTimeZone(timeZone);
	const rules = rewardClaimAllowance?.rules ?? [];
	const { blocking, inline, hidden } = getRulePlacement({ rules, blockingRuleIds, limitingRuleId });
	const meterPoints = Math.min(threshold, Math.max(0, showCarryover ? carryoverPoints : points));
	const formatWhen = useRelativeWhen({ timeZone: resolvedTimeZone, dateFormat, timeFormat });
	const formatPoints = (value: number) => value.toLocaleString(i18n.resolvedLanguage);

	useEffect(() => {
		if (!rewardClaimAllowance?.changesAt) return;
		const timer = setTimeout(
			() => router.refresh(),
			Math.min(2_147_483_647, Math.max(0, Date.parse(rewardClaimAllowance.changesAt) - Date.now()) + 100),
		);
		return () => clearTimeout(timer);
	}, [rewardClaimAllowance, router]);

	const claimMutation = trpc.claim.claimReward.useMutation({
		onSuccess: () => {
			toast({
				title: t("Reward claimed"),
				description: t("We deducted {{points}} points. Nice work!", { points: formatPoints(threshold) }),
			});
			startTransition(() => router.refresh());
		},
		onError: (error) => {
			toast({
				title:
					error.data?.appErrorCode === "REWARD_CLAIM_LIMIT_REACHED" ? t("Claim limit reached") : t("Not quite there"),
				description:
					(error.data?.appErrorCode === "REWARD_CLAIM_LIMIT_REACHED"
						? t("Your reward allowance has been used for this period.")
						: error.message) ??
					t("You need {{points}} more points to claim a reward.", {
						points: formatPoints(threshold - points),
					}),
				variant: "destructive",
			});
			startTransition(() => router.refresh());
		},
	});

	const isBusy = isPending || claimMutation.isPending;
	const hasActivity = tasksLastWeek > 0 || lastTaskAt !== null || currentStreak > 0;
	// A first task awaiting approval isn't activity yet, but it shouldn't read as "No tasks logged yet" either.
	const isZeroState = points <= 0 && threshold > 0 && !hasActivity && !hasPendingTasks;
	// Once a reward is affordable, the meter only tracks the next one and steps back visually.
	const meterDemoted = hasEnoughPoints && threshold > 0;

	// A lone blocker sits beside the headline; several get their own rows beneath it.
	const soleBlocker = blocking.length === 1 ? blocking[0] : undefined;
	const blockingRows = blocking.length > 1 ? blocking : [];
	const lastToResetId = blocking.length > 1 && resumesAt ? blocking[0]?.id : undefined;
	// The banner's own date covers a lone blocker's reset.
	const showsReset = (rule: Rule) => Boolean(rule.changesAt) && rule !== soleBlocker;

	const ruleHeading = (rule: Rule) => (
		<div className="flex items-start gap-2">
			<span className="min-w-0 pt-0.5 text-sm font-medium">{formatRuleName(rule, i18n.resolvedLanguage, t)}</span>
			<AllowancePill rule={rule} t={t} />
		</div>
	);

	const ruleRow = (rule: Rule, index: number, columns: boolean) => {
		const isLast = rule.id === lastToResetId;
		const when = rule.changesAt ? formatWhen(rule.changesAt) : "";
		return (
			<li
				key={rule.id}
				className={cn(
					"space-y-1 border-current/10 py-3",
					index > 0 && "border-t",
					columns && index === 1 && "md:border-t-0",
				)}
			>
				{ruleHeading(rule)}
				{/* Carried-over claims extend this month's allowance on top of its own limit. */}
				{(rule.carried ?? 0) > 0 ? (
					<p className="text-sm text-muted-foreground">
						{t("Plus {{carried}} carried over", { carried: rule.carried })}
					</p>
				) : null}
				{showsReset(rule) ? (
					<p className={cn("text-sm", isLast ? "font-medium text-foreground" : "text-muted-foreground")}>
						{rule.period === "ROLLING"
							? isLast
								? t("Next claim frees up {{when}} · last to reset", { when })
								: t("Next claim frees up {{when}}", { when })
							: isLast
								? t("Resets {{when}} · last to reset", { when })
								: t("Resets {{when}}", { when })}
					</p>
				) : null}
			</li>
		);
	};

	const ruleList = (list: Rule[], className?: string) =>
		list.length > 0 ? (
			<ul className={cn("grid gap-x-10", list.length > 1 && "md:grid-cols-2", className)}>
				{list.map((rule, index) => ruleRow(rule, index, list.length > 1))}
			</ul>
		) : null;

	// Non-blocking rules sit in a neutral area: inline, or behind a disclosure when two or more would crowd it.
	const otherLimits = (className: string) => {
		if (inline.length === 0 && hidden.length === 0) return null;
		return (
			<div className={cn("px-4 py-1", className)}>
				{ruleList(inline)}
				{hidden.length > 0 ? (
					<>
						<button
							type="button"
							className={cn(
								"group -mx-2 my-1 inline-flex min-h-11 cursor-pointer items-center gap-1 rounded-md px-2 text-sm font-medium focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring",
								inline.length > 0 && "mt-0",
							)}
							aria-expanded={limitsOpen}
							aria-controls={limitsId}
							onClick={() => setLimitsOpen((open) => !open)}
						>
							<span className="underline decoration-current/40 underline-offset-4 group-hover:decoration-current">
								{t("Other claim limits ({{number}})", { number: hidden.length })}
							</span>
							<ChevronDownIcon
								aria-hidden="true"
								className={cn(
									"size-4 shrink-0 transition-transform motion-reduce:transition-none",
									limitsOpen && "rotate-180",
								)}
							/>
						</button>
						<div id={limitsId} hidden={!limitsOpen} className="border-t border-current/10">
							{ruleList(hidden)}
						</div>
					</>
				) : null}
			</div>
		);
	};

	// Every banner shares one frame: icon, headline and caption on the left, its chip or action on the right,
	// then blocking rows and other limits as full-width sections.
	const banner = ({
		tone,
		headline,
		caption,
		aside,
	}: {
		tone: "ready" | "blocked";
		headline: string;
		caption?: ReactNode;
		aside?: ReactNode;
	}) => ({
		headline,
		element: (
			<section
				aria-label={t("Rewards")}
				className={cn(
					"overflow-hidden rounded-lg border",
					tone === "ready"
						? "border-emerald-700/30 bg-emerald-50 dark:border-emerald-400/35 dark:bg-emerald-400/[0.08]"
						: "border-amber-600/40 bg-amber-50 text-amber-950 dark:border-amber-400/60 dark:bg-amber-400/[0.08] dark:text-amber-50",
				)}
			>
				<div className="flex flex-col gap-3 p-4 md:flex-row md:items-center md:justify-between md:gap-x-8">
					<div className="flex min-w-0 gap-3">
						{tone === "ready" ? (
							<CheckCircle2Icon
								className="mt-0.5 size-5 shrink-0 text-emerald-700 dark:text-emerald-400"
								aria-hidden="true"
							/>
						) : (
							<LockIcon className="mt-0.5 size-5 shrink-0 text-amber-700 dark:text-amber-300" aria-hidden="true" />
						)}
						<div className="min-w-0 space-y-1">
							<p className="font-semibold text-foreground">{headline}</p>
							{caption}
						</div>
					</div>
					{aside ? <div className="pl-8 md:shrink-0 md:pl-0">{aside}</div> : null}
				</div>
				{ruleList(blockingRows, "border-t border-current/10 px-4")}
				{otherLimits("border-t border-current/10 bg-card text-foreground")}
			</section>
		),
	});

	const blockedCaption = (text: string | null) =>
		text ? <p className="text-sm text-muted-foreground">{text}</p> : null;

	const claimBanner = isPaused
		? banner({
				tone: "blocked",
				headline: resumesAt
					? t("You can claim again {{when}}", { when: formatWhen(resumesAt) })
					: t("Claiming is paused"),
				caption: blockedCaption(t("Your points are kept")),
				aside: soleBlocker ? ruleHeading(soleBlocker) : null,
			})
		: isBlockedBelow
			? banner({
					tone: "blocked",
					// Points and the limit both stand in the way, so the headline names both.
					headline:
						blocking.length > 1
							? t("Earn {{points}} more pts and wait for the claim limits to reset", {
									points: formatPoints(pointsToGo),
								})
							: t("Earn {{points}} more pts and wait for the claim limit to reset", {
									points: formatPoints(pointsToGo),
								}),
					caption: blockedCaption(
						resumesAt
							? blocking.length > 1
								? t("Last claim limit resets {{when}}", { when: formatWhen(resumesAt) })
								: t("Claim limit resets {{when}}", { when: formatWhen(resumesAt) })
							: null,
					),
					aside: soleBlocker ? ruleHeading(soleBlocker) : null,
				})
			: canClaim
				? banner({
						tone: "ready",
						headline:
							claimableRewards === 1
								? t("{{count}} reward ready to claim", { count: claimableRewards })
								: t("{{count}} rewards ready to claim", { count: claimableRewards }),
						caption:
							rules.length === 0 ? (
								<p className="text-sm text-muted-foreground">{t("No claim limits, only points needed")}</p>
							) : null,
						aside: (
							<Button
								size="lg"
								className="w-full md:w-auto"
								aria-busy={isBusy}
								disabled={isBusy}
								onClick={() => claimMutation.mutate({ householdId })}
							>
								{claimMutation.isPending
									? t("Claiming...")
									: isPending
										? t("Updating...")
										: t("Claim reward · {{points}} pts", { points: formatPoints(threshold) })}
							</Button>
						),
					})
				: null;

	// One sentence shape wherever the meter shows; the banner already states a blocked shortfall.
	const meterCaption = isZeroState
		? t("No tasks logged yet")
		: isBlockedBelow
			? null
			: meterDemoted
				? t("{{points}} pts to another reward", { points: formatPoints(nextRewardPointsToGo) })
				: t("{{points}} pts to your next reward", { points: formatPoints(pointsToGo) });
	const customFill = progressBarColor || null;
	// Blocked claiming fades a custom colour instead of dropping it; the edge stays at full strength.
	const subdued = limitReached && customFill !== null;
	const edges = customFill ? getBarEdgeColors(customFill, subdued ? SUBDUED_FILL_ALPHA : 1) : null;

	return (
		<DashboardCard>
			<CardHeader className="flex flex-row items-center gap-2 space-y-0 pb-4">
				<TrophyIcon className="size-5 shrink-0 text-muted-foreground" aria-hidden="true" />
				<CardTitle className="text-xl font-semibold">{t("Overview")}</CardTitle>
			</CardHeader>
			<CardContent className="space-y-5">
				<section aria-label={t("Current balance")} className="space-y-1">
					<p className="text-sm font-medium text-muted-foreground">{t("Current balance")}</p>
					<p className="text-4xl font-semibold tracking-tight tabular-nums">
						{t("{{points}} pts", { points: formatPoints(points) })}
					</p>
				</section>

				{/* Stays mounted across states so screen readers announce changes to it. */}
				<p role="status" className="sr-only">
					{claimBanner?.headline ?? ""}
				</p>
				{claimBanner?.element ?? null}

				{threshold > 0 ? (
					<div className="space-y-2">
						<Progress
							value={meterPoints}
							max={threshold}
							aria-label={showCarryover ? t("Progress to another reward") : t("Progress to your next reward")}
							getValueLabel={(value, max) =>
								t("{{points}} of {{threshold}} pts", { points: formatPoints(value), threshold: formatPoints(max) })
							}
							className={cn(meterDemoted ? "h-1.5" : "h-2.5", "bg-primary/15 dark:bg-primary/20")}
							indicatorClassName={cn(
								"rounded-full",
								// Dimmed whenever claiming is blocked, whatever the balance; both stay 3:1 against the track.
								limitReached && !customFill && "bg-stone-500 dark:bg-zinc-400",
								edges?.light && "shadow-[inset_0_0_0_1.5px_var(--bar-edge-light)]",
								edges?.dark && "dark:shadow-[inset_0_0_0_1.5px_var(--bar-edge-dark)]",
								edges && !edges.dark && "dark:shadow-none",
							)}
							indicatorStyle={
								customFill
									? ({
											backgroundColor: subdued
												? `color-mix(in srgb, ${customFill} ${SUBDUED_FILL_ALPHA * 100}%, transparent)`
												: customFill,
											"--bar-edge-light": edges?.light ?? undefined,
											"--bar-edge-dark": edges?.dark ?? undefined,
										} as CSSProperties)
									: undefined
							}
						/>
						<div className="flex flex-wrap items-baseline gap-x-4 gap-y-1 text-sm">
							{meterCaption ? (
								<span className={meterDemoted ? "text-muted-foreground" : "font-medium"}>{meterCaption}</span>
							) : null}
							{/* The claim button carries the cost when it is shown. */}
							{canClaim ? null : (
								<span className="text-muted-foreground">
									{t("Each reward costs {{points}} pts", { points: formatPoints(threshold) })}
								</span>
							)}
						</div>
						{isZeroState ? (
							<Button asChild className="mt-2 w-full sm:w-auto">
								<a href={`#${QUICK_LOG_ANCHOR}`}>{t("Log a task")}</a>
							</Button>
						) : null}
					</div>
				) : null}

				{claimBanner ? null : otherLimits("-mt-1 rounded-lg bg-muted/50")}

				{hasActivity ? (
					<dl className="grid grid-cols-2 gap-x-6 gap-y-4 border-t pt-5 md:grid-cols-4">
						<Stat label={t("Tasks (7 days)")} value={formatPoints(tasksLastWeek)} />
						<Stat
							label={t("Points earned (7 days)")}
							value={t("{{points}} pts", { points: formatPoints(pointsLastWeek) })}
						/>
						<Stat label={t("Last task logged")} value={formatLastTaskAt(lastTaskAt, resolvedTimeZone, dateFormat, t)} />
						<Stat label={t("Current streak")} value={formatStreak(currentStreak, t)} />
					</dl>
				) : null}
			</CardContent>
		</DashboardCard>
	);
};

const AllowancePill = ({ rule, t }: { rule: Rule; t: Translate }) => {
	const blocking = rule.remaining === 0;
	return (
		<span
			className={cn(
				"inline-flex shrink-0 items-center rounded-full px-2 py-0.5 text-[13px] leading-5 font-semibold whitespace-nowrap tabular-nums",
				blocking
					? "bg-amber-600/15 text-amber-900 dark:bg-amber-300/15 dark:text-amber-200"
					: "bg-foreground/[0.07] text-foreground",
			)}
		>
			{/* Monthly rules count this month's allowance; carried-over claims are listed beneath. */}
			{t("{{remaining}} of {{limit}} left", { remaining: rule.thisMonth ?? rule.remaining, limit: rule.maxClaims })}
		</span>
	);
};

const Stat = ({ label, value }: { label: string; value: string }) => (
	<div className="space-y-1">
		<dt className="text-sm text-muted-foreground">{label}</dt>
		<dd className="text-lg font-semibold tabular-nums">{value}</dd>
	</div>
);

// Names who the allowance covers and over what span, so a chip never reads as a reward count.
const formatRuleName = (rule: Rule, language: string | undefined, t: Translate) => {
	const period =
		rule.period === "DAY"
			? t("today")
			: rule.period === "WEEK"
				? t("this week")
				: rule.period === "MONTH"
					? t("this month")
					: t("in any {{duration}}", { duration: formatRollingWindow(rule.windowMinutes ?? 0, language) });
	return rule.scope === "HOUSEHOLD"
		? t("Household claims {{period}}", { period })
		: t("Your claims {{period}}", { period });
};

const formatLastTaskAt = (lastTaskAt: string | null, timeZone: string, dateFormat: DateFormat, t: Translate) => {
	if (!lastTaskAt) {
		return t("No tasks yet");
	}
	const last = new Date(lastTaskAt);
	if (Number.isNaN(last.getTime())) {
		return t("Unknown");
	}
	const diffDays = getTimeZoneDayNumber(new Date(), timeZone) - getTimeZoneDayNumber(last, timeZone);

	if (diffDays <= 0) {
		return t("Today");
	}
	if (diffDays === 1) {
		return t("Yesterday");
	}
	if (diffDays < 7) {
		return t("{{days}} days ago", { days: diffDays });
	}

	return formatDate(last, { timeZone, dateFormat });
};

const formatStreak = (currentStreak: number, t: Translate) => {
	if (currentStreak <= 0) {
		return t("No streak yet");
	}
	if (currentStreak === 1) {
		return t("{{days}} day", { days: currentStreak });
	}
	return t("{{days}} days", { days: currentStreak });
};

const formatRollingWindow = (minutes: number, language = "en") => {
	const [unit, divisor] =
		minutes % 10080 === 0
			? (["week", 10080] as const)
			: minutes % 1440 === 0
				? (["day", 1440] as const)
				: minutes % 60 === 0
					? (["hour", 60] as const)
					: (["minute", 1] as const);
	return new Intl.NumberFormat(language, { style: "unit", unit, unitDisplay: "long" }).format(minutes / divisor);
};
