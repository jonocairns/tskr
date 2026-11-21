export type PointsSummaryMetrics = {
	progress: number;
	pointsToGo: number;
	rewardsAvailable: number;
	carryoverPoints: number;
	nextRewardProgress: number;
	nextRewardPointsToGo: number;
	canClaim: boolean;
	showCarryover: boolean;
};

type Input = {
	points: number;
	threshold: number;
};

export function getPointsSummaryMetrics({ points, threshold }: Input): PointsSummaryMetrics {
	const hasValidThreshold = threshold > 0;
	const progress = hasValidThreshold ? Math.min(100, Math.max(0, Math.round((points / threshold) * 100))) : 100;
	const pointsToGo = hasValidThreshold ? Math.max(threshold - points, 0) : 0;
	const rewardsAvailable = hasValidThreshold ? Math.floor(points / threshold) : 0;
	const carryoverPoints = hasValidThreshold ? points % threshold : 0;
	const nextRewardProgress = hasValidThreshold ? Math.round((carryoverPoints / threshold) * 100) : 0;
	const nextRewardPointsToGo = hasValidThreshold ? Math.max(threshold - carryoverPoints, 0) : 0;
	const canClaim = points >= threshold;
	const showCarryover = canClaim && hasValidThreshold;

	return {
		progress,
		pointsToGo,
		rewardsAvailable,
		carryoverPoints,
		nextRewardProgress,
		nextRewardPointsToGo,
		canClaim,
		showCarryover,
	};
}

type ClaimRule = { id: string; remaining: number; changesAt: string | null };

type ClaimStatusInput = {
	rewardsAvailable: number;
	allowance: { remaining: number; rules: ClaimRule[] } | null;
};

// Every rule must have allowance, so claiming resumes when the last blocking rule frees a slot.
// Blocking rules are ordered latest-first, so the rule that sets the resume time leads.
export const getClaimStatus = ({ rewardsAvailable, allowance }: ClaimStatusInput) => {
	const rules = allowance?.rules ?? [];
	const blockingRules = rules
		.filter((rule) => rule.remaining === 0)
		.sort((a, b) => (b.changesAt ?? "\uffff").localeCompare(a.changesAt ?? "\uffff"));
	const resumesAt =
		blockingRules.length > 0 && blockingRules.every((rule) => rule.changesAt !== null)
			? (blockingRules[0]?.changesAt ?? null)
			: null;
	const limitReached = blockingRules.length > 0;
	const claimableRewards = limitReached ? 0 : Math.min(rewardsAvailable, allowance?.remaining ?? rewardsAvailable);
	const limitingRule = rules.reduce<ClaimRule | null>(
		(tightest, rule) => (!tightest || rule.remaining < tightest.remaining ? rule : tightest),
		null,
	);
	return {
		blockingRuleIds: blockingRules.map((rule) => rule.id),
		limitingRuleId: limitingRule?.id ?? null,
		limitReached,
		resumesAt,
		claimableRewards: Math.max(0, claimableRewards),
	};
};

type PlacedRule = { id: string };

// Blocking rules lead the banner. Other rules show inline unless two or more would be hidden,
// so a disclosure never holds a single rule or repeats one already on screen.
export const getRulePlacement = <T extends PlacedRule>({
	rules,
	blockingRuleIds,
	limitingRuleId,
}: {
	rules: T[];
	blockingRuleIds: string[];
	limitingRuleId: string | null;
}) => {
	const byId = new Map(rules.map((rule) => [rule.id, rule]));
	const blocking = blockingRuleIds.flatMap((id) => byId.get(id) ?? []);
	const others = rules.filter((rule) => !blockingRuleIds.includes(rule.id));
	// Without a blocker, the tightest rule stays visible so the allowance is always explained.
	const lead = blocking.length === 0 ? others.find((rule) => rule.id === limitingRuleId) : undefined;
	const rest = others.filter((rule) => rule !== lead);
	if (rest.length < 2) {
		return { blocking, inline: lead ? [lead, ...rest] : rest, hidden: [] as T[] };
	}
	return { blocking, inline: lead ? [lead] : [], hidden: rest };
};

const LIGHT_TRACK = [216, 214, 211] as const;
const DARK_TRACK = [57, 57, 58] as const;

const channel = (value: number) => {
	const c = value / 255;
	return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
};
const luminance = ([r, g, b]: readonly number[]) =>
	0.2126 * channel(r ?? 0) + 0.7152 * channel(g ?? 0) + 0.0722 * channel(b ?? 0);
const contrast = (a: readonly number[], b: readonly number[]) => {
	const [high, low] = [luminance(a), luminance(b)].sort((x, y) => y - x);
	return ((high ?? 0) + 0.05) / ((low ?? 0) + 0.05);
};
const toHex = (rgb: number[]) => `#${rgb.map((c) => Math.round(c).toString(16).padStart(2, "0")).join("")}`;

// Paused claiming keeps the household's colour but fades it, so the bar reads as inactive.
export const SUBDUED_FILL_ALPHA = 0.45;

// A custom fill that blends into the track gets an edge in its own hue, darkened on light
// themes and lightened on dark ones, until the boundary reaches 3:1 against the track. A faded
// fill (alpha < 1) starts from the colour it shows over the track, so its edge stays muted too.
export const getBarEdgeColors = (hex: string, alpha = 1) => {
	const match = /^#([0-9a-f]{2})([0-9a-f]{2})([0-9a-f]{2})$/i.exec(hex);
	if (!match) return { light: null, dark: null };
	const rgb = match.slice(1).map((part) => Number.parseInt(part, 16));
	const edge = (track: readonly number[], toward: number) => {
		const shown = rgb.map((c, index) => c * alpha + (track[index] ?? 0) * (1 - alpha));
		if (contrast(shown, track) >= 3) return null;
		for (let mix = 0.1; mix <= 1; mix += 0.05) {
			// Measure the rounded colour that is actually emitted.
			const candidate = shown.map((c) => Math.round(c + (toward - c) * mix));
			if (contrast(candidate, track) >= 3) return toHex(candidate);
		}
		return toHex(shown.map(() => toward));
	};
	return { light: edge(LIGHT_TRACK, 0), dark: edge(DARK_TRACK, 255) };
};
