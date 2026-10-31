"use client";

import { useEffect, useRef, useState } from "react";

import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Label } from "@/components/ui/Label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/Select";
import { useTranslation } from "@/lib/i18nClient";
import {
	MAX_REWARD_CLAIM_RULES,
	MAX_ROLLING_MINUTES,
	REWARD_CLAIM_PERIODS,
	type RewardClaimRule,
} from "@/lib/rewardClaimSettings";
import { trpc } from "@/lib/trpc/react";

const WINDOW_UNITS = { MINUTES: 1, HOURS: 60, DAYS: 1440, WEEKS: 10080 } as const;
type WindowUnit = keyof typeof WINDOW_UNITS;
export type RewardClaimRuleDraft = RewardClaimRule & { key: string; windowUnit: WindowUnit };

let nextRuleKey = 0;

export const toRewardClaimRuleDraft = (rule: RewardClaimRule) => ({
	...rule,
	key: `reward-rule-${nextRuleKey++}`,
	windowUnit: (rule.windowMinutes && rule.windowMinutes % 10080 === 0
		? "WEEKS"
		: rule.windowMinutes && rule.windowMinutes % 1440 === 0
			? "DAYS"
			: rule.windowMinutes && rule.windowMinutes % 60 === 0
				? "HOURS"
				: "MINUTES") as WindowUnit,
});

type Props = {
	householdId: string;
	rules: RewardClaimRuleDraft[];
	onChange: (rules: RewardClaimRuleDraft[]) => void;
	disabled: boolean;
};

export const RewardClaimLimitsEditor = ({ householdId, rules, onChange, disabled }: Props) => {
	const { t } = useTranslation();
	const { data } = trpc.households.getMembers.useQuery({ householdId });
	const pendingFocusId = useRef<string | null>(null);
	const addButtonRef = useRef<HTMLButtonElement>(null);
	const [touchedFields, setTouchedFields] = useState<Set<string>>(new Set());
	const [removedRule, setRemovedRule] = useState<{ rule: RewardClaimRuleDraft; index: number } | null>(null);
	const [announcement, setAnnouncement] = useState("");
	const touch = (id: string) => setTouchedFields((previous) => new Set(previous).add(id));
	useEffect(() => {
		if (!pendingFocusId.current) return;
		if (pendingFocusId.current === "add") addButtonRef.current?.focus();
		else document.getElementById(pendingFocusId.current)?.focus();
		pendingFocusId.current = null;
	});
	const add = () => {
		const rule = toRewardClaimRuleDraft({
			maxClaims: 1,
			period: "WEEK",
			windowMinutes: null,
			scope: "HOUSEHOLD",
			userId: null,
		});
		pendingFocusId.current = `${rule.key}-target`;
		setAnnouncement(t("Limit added. Save changes to apply."));
		onChange([...rules, rule]);
	};
	const remove = (rule: RewardClaimRuleDraft, index: number) => {
		setRemovedRule({ rule, index });
		const next = rules[index + 1] ?? rules[index - 1];
		pendingFocusId.current = next ? `${next.key}-target` : "add";
		setAnnouncement(t("Limit removed. Save changes to apply, or undo the removal."));
		onChange(rules.filter((item) => item.key !== rule.key));
	};
	const undo = () => {
		if (!removedRule) return;
		const restored = [...rules];
		restored.splice(removedRule.index, 0, removedRule.rule);
		pendingFocusId.current = `${removedRule.rule.key}-target`;
		setRemovedRule(null);
		setAnnouncement(t("Limit restored. Save changes to apply."));
		onChange(restored);
	};
	const update = (key: string, change: Partial<RewardClaimRuleDraft>) =>
		onChange(rules.map((rule) => (rule.key === key ? { ...rule, ...change } : rule)));

	return (
		<div className="space-y-3">
			<div className="space-y-1">
				<p className="text-sm font-medium">{t("Reward claim limits")}</p>
				<p className="text-xs text-muted-foreground">
					{t("Combine limits for the household or its members. Every applicable limit must allow the claim.")}
				</p>
			</div>
			{rules.length === 0 && (
				<p className="text-sm text-muted-foreground">
					{t("No limits are set. Members can claim whenever they have enough points.")}
				</p>
			)}
			{rules.map((rule, index) => {
				const countInvalid = !Number.isInteger(rule.maxClaims) || rule.maxClaims < 1 || rule.maxClaims > 10000;
				const durationInvalid =
					rule.period === "ROLLING" &&
					(!Number.isInteger(rule.windowMinutes) ||
						!rule.windowMinutes ||
						rule.windowMinutes < 1 ||
						rule.windowMinutes > MAX_ROLLING_MINUTES);
				const showCountError = countInvalid && touchedFields.has(`${rule.key}-count`);
				const showDurationError = durationInvalid && touchedFields.has(`${rule.key}-length`);
				return (
					<fieldset
						key={rule.key}
						disabled={disabled}
						className="space-y-3 rounded-lg border p-3"
						aria-describedby={`${rule.key}-help`}
					>
						<legend className="px-1 text-sm">{t("Limit {{number}}", { number: index + 1 })}</legend>
						<div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
							<div className="space-y-2 sm:col-span-2 lg:col-span-1">
								<Label htmlFor={`${rule.key}-target`}>{t("Applies to")}</Label>
								<Select
									disabled={disabled}
									value={rule.scope === "HOUSEHOLD" ? "household" : (rule.userId ?? "members")}
									onValueChange={(value) =>
										update(rule.key, {
											scope: value === "household" ? "HOUSEHOLD" : "MEMBER",
											userId: value === "household" || value === "members" ? null : value,
										})
									}
								>
									<SelectTrigger className="h-11 sm:h-9" id={`${rule.key}-target`}>
										<SelectValue />
									</SelectTrigger>
									<SelectContent>
										<SelectItem className="min-h-11 sm:min-h-8" value="household">
											{t("Whole household (shared)")}
										</SelectItem>
										<SelectItem className="min-h-11 sm:min-h-8" value="members">
											{t("Each member separately")}
										</SelectItem>
										{data?.members.map((member) => (
											<SelectItem className="min-h-11 sm:min-h-8" key={member.userId} value={member.userId}>
												{member.user.name ?? member.user.email ?? t("Unnamed member")}
											</SelectItem>
										))}
									</SelectContent>
								</Select>
							</div>
							<div className="space-y-2">
								<Label htmlFor={`${rule.key}-count`}>{t("Maximum rewards")}</Label>
								<Input
									id={`${rule.key}-count`}
									type="number"
									min={1}
									max={10000}
									step={1}
									className="h-11 sm:h-9"
									onBlur={() => touch(`${rule.key}-count`)}
									aria-invalid={showCountError || undefined}
									aria-describedby={showCountError ? `${rule.key}-count-error` : undefined}
									value={rule.maxClaims || ""}
									onChange={(event) => update(rule.key, { maxClaims: Number(event.target.value) })}
								/>
								{showCountError && (
									<p id={`${rule.key}-count-error`} className="text-xs text-destructive" role="alert">
										{t("Enter a whole number from 1 to 10,000.")}
									</p>
								)}
							</div>
							<div className="space-y-2">
								<Label htmlFor={`${rule.key}-period`}>{t("Claim period")}</Label>
								<Select
									disabled={disabled}
									value={rule.period}
									onValueChange={(period: RewardClaimRule["period"]) =>
										update(rule.key, {
											period,
											windowMinutes: period === "ROLLING" ? 10080 : null,
											windowUnit: "WEEKS",
										})
									}
								>
									<SelectTrigger className="h-11 sm:h-9" id={`${rule.key}-period`}>
										<SelectValue />
									</SelectTrigger>
									<SelectContent>
										{REWARD_CLAIM_PERIODS.map((period) => (
											<SelectItem className="min-h-11 sm:min-h-8" key={period} value={period}>
												{period === "DAY"
													? t("Calendar day")
													: period === "WEEK"
														? t("Calendar week")
														: period === "MONTH"
															? t("Calendar month")
															: t("Rolling window")}
											</SelectItem>
										))}
									</SelectContent>
								</Select>
							</div>
						</div>
						{rule.period === "ROLLING" && (
							<div className="grid gap-3 sm:grid-cols-2">
								<div className="space-y-2">
									<Label htmlFor={`${rule.key}-length`}>{t("Window length")}</Label>
									<Input
										id={`${rule.key}-length`}
										type="number"
										min={1 / WINDOW_UNITS[rule.windowUnit]}
										max={MAX_ROLLING_MINUTES / WINDOW_UNITS[rule.windowUnit]}
										step="any"
										className="h-11 sm:h-9"
										onBlur={() => touch(`${rule.key}-length`)}
										aria-invalid={showDurationError || undefined}
										aria-describedby={showDurationError ? `${rule.key}-length-error` : undefined}
										value={(rule.windowMinutes ?? 0) / WINDOW_UNITS[rule.windowUnit] || ""}
										onChange={(event) =>
											update(rule.key, { windowMinutes: Number(event.target.value) * WINDOW_UNITS[rule.windowUnit] })
										}
									/>
									{showDurationError && (
										<p id={`${rule.key}-length-error`} className="text-xs text-destructive" role="alert">
											{t("Enter a duration from 1 minute to 365 days, in whole minutes.")}
										</p>
									)}
								</div>
								<div className="space-y-2">
									<Label htmlFor={`${rule.key}-unit`}>{t("Time unit")}</Label>
									<Select
										disabled={disabled}
										value={rule.windowUnit}
										onValueChange={(windowUnit: WindowUnit) =>
											update(rule.key, {
												windowUnit,
												windowMinutes:
													((rule.windowMinutes ?? 0) / WINDOW_UNITS[rule.windowUnit]) * WINDOW_UNITS[windowUnit],
											})
										}
									>
										<SelectTrigger className="h-11 sm:h-9" id={`${rule.key}-unit`}>
											<SelectValue />
										</SelectTrigger>
										<SelectContent>
											{(Object.keys(WINDOW_UNITS) as WindowUnit[]).map((unit) => (
												<SelectItem className="min-h-11 sm:min-h-8" key={unit} value={unit}>
													{unit === "MINUTES"
														? t("Minutes")
														: unit === "HOURS"
															? t("Hours")
															: unit === "DAYS"
																? t("Days")
																: t("Weeks")}
												</SelectItem>
											))}
										</SelectContent>
									</Select>
								</div>
							</div>
						)}
						<p id={`${rule.key}-help`} className="text-xs text-muted-foreground">
							{rule.scope === "HOUSEHOLD"
								? t("One allowance shared by everyone in this household.")
								: rule.userId === null
									? t("Each member gets a separate allowance. Other limits still apply.")
									: t("This member's allowance applies alongside household and per-member limits.")}
						</p>
						<Button
							type="button"
							variant="outline"
							size="sm"
							className="h-11 sm:h-8"
							aria-label={t("Remove limit {{number}}", { number: index + 1 })}
							onClick={() => remove(rule, index)}
						>
							{t("Remove limit")}
						</Button>
					</fieldset>
				);
			})}
			<p className="sr-only" role="status">
				{announcement}
			</p>
			{removedRule && (
				<Button
					type="button"
					variant="outline"
					disabled={disabled || rules.length >= MAX_REWARD_CLAIM_RULES}
					onClick={undo}
					className="h-11 sm:h-9"
				>
					{t("Undo removal")}
				</Button>
			)}
			<Button
				type="button"
				variant="outline"
				disabled={disabled || rules.length >= MAX_REWARD_CLAIM_RULES}
				ref={addButtonRef}
				className="h-11 sm:h-9"
				onClick={add}
			>
				{t("Add limit")}
			</Button>
			{rules.length >= MAX_REWARD_CLAIM_RULES && (
				<p className="text-xs text-muted-foreground">
					{t("You can combine up to 20 limits. Remove one to add another.")}
				</p>
			)}
			{rules.length > 0 && (
				<p className="text-xs text-muted-foreground">
					{t(
						"Calendar periods follow the household time zone; weeks start Monday. Rolling windows use elapsed time, up to 365 days. Existing claims count, and reverted claims free up allowance.",
					)}
				</p>
			)}
		</div>
	);
};
