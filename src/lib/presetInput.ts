import { z } from "zod";

import { DURATION_KEYS } from "@/lib/points";

export const PRESET_LABEL_MIN_LENGTH = 2;
export const PRESET_LABEL_MAX_LENGTH = 50;

export const presetLabelSchema = z
	.string()
	.trim()
	.min(PRESET_LABEL_MIN_LENGTH, "Name is too short")
	.max(PRESET_LABEL_MAX_LENGTH, "Keep the name short");
export const presetBucketSchema = z.enum(DURATION_KEYS);
export const presetIconKeySchema = z.string().trim().min(1).max(100).nullish();
export const presetApprovalOverrideSchema = z.enum(["REQUIRE", "SKIP"]).nullish();

export type PresetApprovalOverride = z.infer<typeof presetApprovalOverrideSchema>;
