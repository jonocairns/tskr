import { z } from "zod";

// Common schemas
export const roleSchema = z.enum(["DICTATOR", "APPROVER", "DOER"]);
export const durationKeySchema = z.enum(["QUICK", "SHORT", "MEDIUM", "LONG", "EPIC"]);
export const entryStatusSchema = z.enum(["APPROVED", "PENDING", "REJECTED"]);

// User schemas
export const userSchema = z.object({
	id: z.string(),
	name: z.string().nullable(),
	email: z.string().nullable(),
	image: z.string().nullable(),
});

// Member schemas
export const memberSchema = z.object({
	id: z.string(),
	userId: z.string(),
	role: roleSchema,
	requiresApprovalDefault: z.boolean(),
	user: userSchema,
});

export const membersResponseSchema = z.object({
	members: z.array(memberSchema),
});

export const updateMemberSchema = z.object({
	role: roleSchema.optional(),
	requiresApprovalDefault: z.boolean().optional(),
});

// Household schemas
export const householdSchema = z.object({
	id: z.string(),
	name: z.string(),
	createdAt: z.string(),
});

export const householdsResponseSchema = z.object({
	households: z.array(householdSchema),
});

export const createHouseholdSchema = z.object({
	name: z.string(),
});

// Preset schemas
export const presetSummarySchema = z.object({
	id: z.string(),
	label: z.string(),
	bucket: durationKeySchema,
	isShared: z.boolean(),
});

export const presetsResponseSchema = z.object({
	presets: z.array(presetSummarySchema),
});

export const createPresetSchema = z.object({
	label: z.string(),
	bucket: durationKeySchema,
	isShared: z.boolean().optional(),
});

export const updatePresetSchema = z.object({
	label: z.string().optional(),
	bucket: durationKeySchema.optional(),
	isShared: z.boolean().optional(),
});

// Log schemas
export const logEntrySchema = z.object({
	id: z.string(),
	type: z.enum(["preset", "timed", "assigned"]),
	description: z.string().nullable(),
	points: z.number(),
	durationMinutes: z.number().nullable(),
	status: entryStatusSchema,
	createdAt: z.string(),
	userId: z.string(),
	presetId: z.string().nullable(),
	user: userSchema.optional(),
});

export const logsResponseSchema = z.object({
	logs: z.array(logEntrySchema),
});

export const createLogSchema = z.object({
	type: z.enum(["preset", "timed"]),
	presetKey: z.string().optional(),
	presetId: z.string().optional(),
	durationMinutes: z.number().optional(),
	description: z.string().optional(),
});

export const createLogResponseSchema = z.object({
	entry: logEntrySchema,
});

// Invite schemas
export const inviteSchema = z.object({
	id: z.string(),
	code: z.string(),
	createdAt: z.string(),
	expiresAt: z.string(),
	isExpired: z.boolean(),
});

export const invitesResponseSchema = z.object({
	invites: z.array(inviteSchema),
});

export const createInviteSchema = z.object({
	role: roleSchema.optional(),
});

export const createInviteResponseSchema = z.object({
	invite: inviteSchema,
});

// Assigned task schemas
export const assignedTaskSchema = z.object({
	id: z.string(),
	title: z.string(),
	description: z.string().nullable(),
	points: z.number(),
	completedAt: z.string().nullable(),
	createdAt: z.string(),
	assignedToId: z.string(),
	assignedTo: userSchema.optional(),
});

export const assignedTasksResponseSchema = z.object({
	tasks: z.array(assignedTaskSchema),
});

export const createAssignedTaskSchema = z.object({
	title: z.string(),
	description: z.string().optional(),
	points: z.number(),
	assignedToId: z.string(),
});

// Error schema
export const errorResponseSchema = z.object({
	error: z.string(),
});

// Export types
export type Role = z.infer<typeof roleSchema>;
export type DurationKey = z.infer<typeof durationKeySchema>;
export type User = z.infer<typeof userSchema>;
export type Member = z.infer<typeof memberSchema>;
export type MembersResponse = z.infer<typeof membersResponseSchema>;
export type Household = z.infer<typeof householdSchema>;
export type PresetSummary = z.infer<typeof presetSummarySchema>;
export type PresetsResponse = z.infer<typeof presetsResponseSchema>;
export type LogEntry = z.infer<typeof logEntrySchema>;
export type LogsResponse = z.infer<typeof logsResponseSchema>;
export type CreateLog = z.infer<typeof createLogSchema>;
export type Invite = z.infer<typeof inviteSchema>;
export type AssignedTask = z.infer<typeof assignedTaskSchema>;
