"use client";

import { GiftIcon, TrophyIcon } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";

import { Button } from "@/components/ui/Button";
import { CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/Card";
import { DashboardCard } from "@/components/ui/DashboardCard";
import { Progress } from "@/components/ui/Progress";
import { useToast } from "@/hooks/useToast";
import { type DateFormat, formatDate } from "@/lib/formatDate";
import { useTranslation } from "@/lib/i18nClient";
import { getPointsSummaryMetrics } from "@/lib/pointsSummary";
import { getTimeZoneDayNumber, resolveTimeZone } from "@/lib/timeZones";
import { trpc } from "@/lib/trpc/react";

type Props = {
	householdId: string;
	points: number;
	threshold: number;
	progressBarColor?: string | null;
	tasksLastWeek: number;
	pointsLastWeek: number;
	lastTaskAt: string | null;
	currentStreak: number;
	timeZone: string;
	dateFormat: DateFormat;
};

export const PointsSummary = ({
	householdId,
	points,
	threshold,
	progressBarColor,
	tasksLastWeek,
	pointsLastWeek,
	lastTaskAt,
	currentStreak,
	timeZone,
	dateFormat,
}: Props) => {
	const [isPending, startTransition] = useTransition();
	const [isSubmitting, setSubmitting] = useState(false);
	const router = useRouter();
	const { toast } = useToast();
	const { t } = useTranslation();

	const { progress, pointsToGo, rewardsAvailable, nextRewardProgress, nextRewardPointsToGo, canClaim, showCarryover } =
		getPointsSummaryMetrics({ points, threshold });
	const progressIndicatorStyle = progressBarColor ? { backgroundColor: progressBarColor } : undefined;
	const overlayBaseColor = progressBarColor ?? "hsl(var(--primary))";
	const overlapIndicatorStyle = {
		backgroundColor: `color-mix(in srgb, ${overlayBaseColor} 70%, black)`,
		backgroundImage:
			"repeating-linear-gradient(135deg, rgba(0,0,0,0.25) 0, rgba(0,0,0,0.25) 6px, rgba(0,0,0,0) 6px, rgba(0,0,0,0) 12px)",
	};
	const progressLabel = canClaim
		? t("{{progress}}% toward another reward", { progress: nextRewardProgress })
		: t("{{progress}}% toward next reward", { progress });
	const resolvedTimeZone = resolveTimeZone(timeZone);
	const rewardsReadyLabel =
		rewardsAvailable === 1
			? t("{{count}} reward ready", { count: rewardsAvailable })
			: t("{{count}} rewards ready", { count: rewardsAvailable });

	const claimMutation = trpc.claim.claimReward.useMutation({
		onSuccess: () => {
			toast({
				title: t("Reward claimed"),
				description: t("We deducted {{points}} points. Nice work!", { points: threshold.toLocaleString() }),
			});
			router.refresh();
		},
		onError: (error) => {
			toast({
				title: t("Not quite there"),
				description:
					error.message ??
					t("You need {{points}} more points to claim a reward.", {
						points: (threshold - points).toLocaleString(),
					}),
				variant: "destructive",
			});
		},
	});

	const handleClaim = () => {
		setSubmitting(true);
		startTransition(async () => {
			await claimMutation.mutateAsync({ householdId });
			setSubmitting(false);
		});
	};

	return (
		<DashboardCard>
			<CardHeader className="flex flex-row items-center justify-between space-y-0">
				<div>
					<CardTitle className="text-xl font-semibold">{t("Overview")}</CardTitle>
					<CardDescription>{t("Log tasks, climb the leaderboard, claim rewards.")}</CardDescription>
				</div>
				<div className="rounded-full bg-primary/10 p-2 text-primary">
					<TrophyIcon className="h-5 w-5" />
				</div>
			</CardHeader>
			<CardContent className="space-y-4">
				<div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
					<div>
						<p className="text-sm text-muted-foreground">{t("Current balance")}</p>
						<p className="text-3xl font-bold">{t("{{points}} pts", { points: points.toLocaleString() })}</p>
					</div>
					<div className="text-sm text-muted-foreground">
						{t("Threshold: {{points}} pts", { points: threshold.toLocaleString() })}
					</div>
				</div>
				<div className="space-y-2">
					<div className="flex items-center justify-between text-sm text-muted-foreground">
						<span>{progressLabel}</span>
						{canClaim ? (
							<span className="inline-flex items-center rounded-full bg-primary/10 px-2 py-0.5 text-xs font-semibold text-primary">
								{t("Reward ready")}
							</span>
						) : (
							<span>{t("{{points}} pts to go", { points: pointsToGo.toLocaleString() })}</span>
						)}
					</div>
					<div className="relative">
						<Progress value={progress} className="h-2" indicatorStyle={progressIndicatorStyle} />
						{showCarryover ? (
							<div className="pointer-events-none absolute inset-0 z-10">
								<div
									className="h-full rounded-full bg-primary transition-all"
									style={{
										width: `${nextRewardProgress}%`,
										...overlapIndicatorStyle,
									}}
								/>
							</div>
						) : null}
					</div>
					{showCarryover ? (
						<div className="flex items-center justify-between text-xs text-muted-foreground">
							<span>{rewardsReadyLabel}</span>
							<span>
								{t("Toward another reward: {{progress}}% ({{points}} pts to go)", {
									progress: nextRewardProgress,
									points: nextRewardPointsToGo.toLocaleString(),
								})}
							</span>
						</div>
					) : null}
				</div>
				<div className="grid grid-cols-2 gap-4 rounded-lg border bg-card/70 p-4 sm:grid-cols-2">
					<Stat label={t("Tasks (7 days)")} value={tasksLastWeek.toLocaleString()} />
					<Stat
						label={t("Points (7 days)")}
						value={t("{{points}} pts", { points: pointsLastWeek.toLocaleString() })}
						muted={pointsLastWeek < 0}
					/>
					<Stat
						label={t("Last task logged")}
						value={formatLastTaskAt(lastTaskAt, resolvedTimeZone, dateFormat, t)}
						muted={!lastTaskAt}
					/>
					<Stat label={t("Current streak")} value={formatStreak(currentStreak, t)} muted={currentStreak === 0} />
				</div>
				<div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
					<div className="flex items-center gap-2 text-sm text-muted-foreground">
						<GiftIcon className="h-4 w-4 text-primary" />
						{t("Rewards instantly remove {{points}} pts.", { points: threshold.toLocaleString() })}
					</div>
					<Button size="lg" disabled={!canClaim || isPending || isSubmitting} onClick={handleClaim}>
						{canClaim ? t("Claim reward") : t("Keep earning")}
					</Button>
				</div>
			</CardContent>
		</DashboardCard>
	);
};

function Stat({ label, value, muted }: { label: string; value: string | number; muted?: boolean }) {
	return (
		<div className="space-y-1">
			<p className="text-sm text-muted-foreground">{label}</p>
			<p className={`text-xl font-semibold ${muted ? "text-muted-foreground" : ""}`}>{value}</p>
		</div>
	);
}

const formatLastTaskAt = (
	lastTaskAt: string | null,
	timeZone: string,
	dateFormat: DateFormat,
	t: (key: string, options?: Record<string, unknown>) => string,
) => {
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

const formatStreak = (currentStreak: number, t: (key: string, options?: Record<string, unknown>) => string) => {
	if (currentStreak <= 0) {
		return t("No streak yet");
	}
	if (currentStreak === 1) {
		return t("{{days}} day", { days: currentStreak });
	}
	return t("{{days}} days", { days: currentStreak });
};
