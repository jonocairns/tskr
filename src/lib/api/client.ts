import { Zodios } from "@zodios/core";
import { ZodiosHooks } from "@zodios/react";
import {
	assignedTasksResponseSchema,
	createAssignedTaskSchema,
	createHouseholdSchema,
	createInviteResponseSchema,
	createInviteSchema,
	createLogResponseSchema,
	createLogSchema,
	createPresetSchema,
	errorResponseSchema,
	householdsResponseSchema,
	invitesResponseSchema,
	logsResponseSchema,
	membersResponseSchema,
	presetsResponseSchema,
	updateMemberSchema,
	updatePresetSchema,
} from "./schemas";

// Define API endpoints with Zodios
export const apiClient = new Zodios("/api", [
	// Members endpoints
	{
		method: "get",
		path: "/households/members",
		alias: "getMembers",
		response: membersResponseSchema,
		errors: [
			{
				status: "default",
				schema: errorResponseSchema,
			},
		],
	},
	{
		method: "patch",
		path: "/households/members/:id",
		alias: "updateMember",
		parameters: [
			{
				name: "id",
				type: "Path",
				schema: membersResponseSchema.shape.members.element.shape.id,
			},
			{
				name: "body",
				type: "Body",
				schema: updateMemberSchema,
			},
		],
		response: membersResponseSchema.shape.members.element.extend({
			member: membersResponseSchema.shape.members.element,
		}),
		errors: [
			{
				status: "default",
				schema: errorResponseSchema,
			},
		],
	},
	{
		method: "delete",
		path: "/households/members/:id",
		alias: "deleteMember",
		parameters: [
			{
				name: "id",
				type: "Path",
				schema: membersResponseSchema.shape.members.element.shape.id,
			},
		],
		response: membersResponseSchema.shape.members.element.pick({ id: true }),
		errors: [
			{
				status: "default",
				schema: errorResponseSchema,
			},
		],
	},

	// Households endpoints
	{
		method: "get",
		path: "/households",
		alias: "getHouseholds",
		response: householdsResponseSchema,
		errors: [
			{
				status: "default",
				schema: errorResponseSchema,
			},
		],
	},
	{
		method: "post",
		path: "/households",
		alias: "createHousehold",
		parameters: [
			{
				name: "body",
				type: "Body",
				schema: createHouseholdSchema,
			},
		],
		response: householdsResponseSchema.shape.households.element.extend({
			household: householdsResponseSchema.shape.households.element,
		}),
		errors: [
			{
				status: "default",
				schema: errorResponseSchema,
			},
		],
	},

	// Presets endpoints
	{
		method: "get",
		path: "/presets",
		alias: "getPresets",
		response: presetsResponseSchema,
		errors: [
			{
				status: "default",
				schema: errorResponseSchema,
			},
		],
	},
	{
		method: "post",
		path: "/presets",
		alias: "createPreset",
		parameters: [
			{
				name: "body",
				type: "Body",
				schema: createPresetSchema,
			},
		],
		response: presetsResponseSchema.shape.presets.element.extend({
			preset: presetsResponseSchema.shape.presets.element,
		}),
		errors: [
			{
				status: "default",
				schema: errorResponseSchema,
			},
		],
	},
	{
		method: "patch",
		path: "/presets/:id",
		alias: "updatePreset",
		parameters: [
			{
				name: "id",
				type: "Path",
				schema: presetsResponseSchema.shape.presets.element.shape.id,
			},
			{
				name: "body",
				type: "Body",
				schema: updatePresetSchema,
			},
		],
		response: presetsResponseSchema.shape.presets.element.extend({
			preset: presetsResponseSchema.shape.presets.element,
		}),
		errors: [
			{
				status: "default",
				schema: errorResponseSchema,
			},
		],
	},
	{
		method: "delete",
		path: "/presets/:id",
		alias: "deletePreset",
		parameters: [
			{
				name: "id",
				type: "Path",
				schema: presetsResponseSchema.shape.presets.element.shape.id,
			},
		],
		response: presetsResponseSchema.shape.presets.element.pick({ id: true }),
		errors: [
			{
				status: "default",
				schema: errorResponseSchema,
			},
		],
	},

	// Logs endpoints
	{
		method: "get",
		path: "/logs",
		alias: "getLogs",
		response: logsResponseSchema,
		errors: [
			{
				status: "default",
				schema: errorResponseSchema,
			},
		],
	},
	{
		method: "post",
		path: "/logs",
		alias: "createLog",
		parameters: [
			{
				name: "body",
				type: "Body",
				schema: createLogSchema,
			},
		],
		response: createLogResponseSchema,
		errors: [
			{
				status: "default",
				schema: errorResponseSchema,
			},
		],
	},
	{
		method: "delete",
		path: "/logs/:id",
		alias: "deleteLog",
		parameters: [
			{
				name: "id",
				type: "Path",
				schema: logsResponseSchema.shape.logs.element.shape.id,
			},
		],
		response: logsResponseSchema.shape.logs.element.pick({ id: true }),
		errors: [
			{
				status: "default",
				schema: errorResponseSchema,
			},
		],
	},

	// Invites endpoints
	{
		method: "get",
		path: "/households/invites",
		alias: "getInvites",
		response: invitesResponseSchema,
		errors: [
			{
				status: "default",
				schema: errorResponseSchema,
			},
		],
	},
	{
		method: "post",
		path: "/households/invites",
		alias: "createInvite",
		parameters: [
			{
				name: "body",
				type: "Body",
				schema: createInviteSchema,
			},
		],
		response: createInviteResponseSchema,
		errors: [
			{
				status: "default",
				schema: errorResponseSchema,
			},
		],
	},
	{
		method: "delete",
		path: "/households/invites/:id",
		alias: "deleteInvite",
		parameters: [
			{
				name: "id",
				type: "Path",
				schema: invitesResponseSchema.shape.invites.element.shape.id,
			},
		],
		response: invitesResponseSchema.shape.invites.element.pick({ id: true }),
		errors: [
			{
				status: "default",
				schema: errorResponseSchema,
			},
		],
	},

	// Assigned tasks endpoints
	{
		method: "get",
		path: "/assigned-tasks",
		alias: "getAssignedTasks",
		response: assignedTasksResponseSchema,
		errors: [
			{
				status: "default",
				schema: errorResponseSchema,
			},
		],
	},
	{
		method: "post",
		path: "/assigned-tasks",
		alias: "createAssignedTask",
		parameters: [
			{
				name: "body",
				type: "Body",
				schema: createAssignedTaskSchema,
			},
		],
		response: assignedTasksResponseSchema.shape.tasks.element.extend({
			task: assignedTasksResponseSchema.shape.tasks.element,
		}),
		errors: [
			{
				status: "default",
				schema: errorResponseSchema,
			},
		],
	},
]);

// Create React hooks instance (use hooks from hooks.ts instead)
export const api = new ZodiosHooks("api", apiClient);
