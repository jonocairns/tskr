"use client";

import { GiftIcon, TrophyIcon } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";

import { Button } from "@/components/ui/button";
import {
	Card,
	CardContent,
	CardDescription,
	CardHeader,
	CardTitle,
} from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { useToast } from "@/hooks/use-toast";

type Props = {
	points: number;
	threshold: number;
	tasksLogged: number;
	rewardsClaimed: number;
};

export function PointsSummary({
	points,
	threshold,
	tasksLogged,
	rewardsClaimed,
}: Props) {
	const [isPending, startTransition] = useTransition();
	const [isSubmitting, setSubmitting] = useState(false);
	const router = useRouter();
	const { toast } = useToast();

	const progress = Math.min(
		100,
		Math.max(0, Math.round((points / threshold) * 100)),
	);
	const canClaim = points >= threshold;

	const handleClaim = () => {
		setSubmitting(true);
		startTransition(async () => {
			const res = await fetch("/api/claim", { method: "POST" });
			setSubmitting(false);

			if (!res.ok) {
				const body = await res.json().catch(() => ({}));
				toast({
					title: "Not quite there",
					description:
						body?.error ??
						`You need ${threshold - points} more points to claim a reward.`,
					variant: "destructive",
				});
				return;
			}

			toast({
				title: "Reward claimed",
				description: `We deducted ${threshold} points. Nice work!`,
			});
			router.refresh();
		});
	};

	return (
		<Card className="border-primary/10 bg-gradient-to-br from-primary/5 via-background to-background shadow-sm">
			<CardHeader className="flex flex-row items-center justify-between space-y-0">
				<div>
					<CardTitle className="text-xl font-semibold">
						Points overview
					</CardTitle>
					<CardDescription>
						Log tasks, climb the leaderboard, claim rewards.
					</CardDescription>
				</div>
				<div className="rounded-full bg-primary/10 p-2 text-primary">
					<TrophyIcon className="h-5 w-5" />
				</div>
			</CardHeader>
			<CardContent className="space-y-4">
				<div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
					<div>
						<p className="text-sm text-muted-foreground">Current balance</p>
						<p className="text-3xl font-bold">{points.toLocaleString()} pts</p>
					</div>
					<div className="text-sm text-muted-foreground">
						Threshold:{" "}
						<span className="font-medium text-foreground">{threshold} pts</span>
					</div>
				</div>
				<div className="space-y-2">
					<div className="flex items-center justify-between text-sm text-muted-foreground">
						<span>{progress}% toward next reward</span>
						<span>
							{Math.max(threshold - points, 0).toLocaleString()} pts to go
						</span>
					</div>
					<Progress value={progress} className="h-2" />
				</div>
				<div className="grid gap-4 rounded-lg border bg-card/70 p-4 sm:grid-cols-3">
					<Stat label="Tasks logged" value={tasksLogged} />
					<Stat label="Rewards claimed" value={rewardsClaimed} />
					<Stat
						label="Net balance"
						value={`${points.toLocaleString()} pts`}
						muted={points < 0}
					/>
				</div>
				<div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
					<div className="flex items-center gap-2 text-sm text-muted-foreground">
						<GiftIcon className="h-4 w-4 text-primary" />
						Rewards instantly remove {threshold} pts.
					</div>
					<Button
						size="lg"
						disabled={!canClaim || isPending || isSubmitting}
						onClick={handleClaim}
					>
						{canClaim ? "Claim reward" : "Keep earning"}
					</Button>
				</div>
			</CardContent>
		</Card>
	);
}

function Stat({
	label,
	value,
	muted,
}: {
	label: string;
	value: string | number;
	muted?: boolean;
}) {
	return (
		<div className="space-y-1">
			<p className="text-sm text-muted-foreground">{label}</p>
			<p
				className={`text-xl font-semibold ${muted ? "text-muted-foreground" : ""}`}
			>
				{value}
			</p>
		</div>
	);
}
