import { z } from "zod";

export const REWARD_CLAIM_PERIODS = ["DAY", "WEEK", "MONTH", "ROLLING"] as const;
export const MAX_REWARD_CLAIM_RULES = 20;
export const MAX_ROLLING_MINUTES = 525600;

export const rewardClaimRuleSchema = z
	.object({
		id: z.string().min(1).optional(),
		rolloverEnabled: z.boolean().optional(),
		maxClaims: z.number().int().min(1).max(10000),
		period: z.enum(REWARD_CLAIM_PERIODS),
		windowMinutes: z.number().int().min(1).max(MAX_ROLLING_MINUTES).nullable(),
		scope: z.enum(["HOUSEHOLD", "MEMBER"]),
		userId: z.string().min(1).nullable(),
	})
	.superRefine((rule, ctx) => {
		if ((rule.period === "ROLLING") !== (rule.windowMinutes !== null)) {
			ctx.addIssue({
				code: "custom",
				path: ["windowMinutes"],
				message: "A window length is required only for rolling limits",
			});
		}
		if (rule.scope === "HOUSEHOLD" && rule.userId !== null) {
			ctx.addIssue({ code: "custom", path: ["userId"], message: "Household limits cannot target a member" });
		}
	});

export const rewardClaimRulesSchema = z.array(rewardClaimRuleSchema).max(MAX_REWARD_CLAIM_RULES);
export type RewardClaimRule = z.infer<typeof rewardClaimRuleSchema>;
