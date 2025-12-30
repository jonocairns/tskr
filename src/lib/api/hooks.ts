import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { apiClient } from "./client";
import type { CreateLog, Member, PresetSummary } from "./schemas";

// Query keys for cache management
export const queryKeys = {
	members: ["members"] as const,
	households: ["households"] as const,
	presets: ["presets"] as const,
	logs: ["logs"] as const,
	invites: ["invites"] as const,
	assignedTasks: ["assigned-tasks"] as const,
};

// Members hooks
export function useMembers() {
	return useQuery({
		queryKey: queryKeys.members,
		queryFn: () => apiClient.getMembers(),
	});
}

export function useUpdateMember() {
	const queryClient = useQueryClient();

	return useMutation({
		mutationFn: ({ id, data }: { id: string; data: Partial<Pick<Member, "role" | "requiresApprovalDefault">> }) =>
			apiClient.updateMember(data, { params: { id } }),
		onSuccess: () => {
			queryClient.invalidateQueries({ queryKey: queryKeys.members });
		},
	});
}

export function useDeleteMember() {
	const queryClient = useQueryClient();

	return useMutation({
		mutationFn: (id: string) => apiClient.deleteMember(undefined, { params: { id } }),
		onSuccess: () => {
			queryClient.invalidateQueries({ queryKey: queryKeys.members });
		},
	});
}

// Presets hooks
export function usePresets() {
	return useQuery({
		queryKey: queryKeys.presets,
		queryFn: () => apiClient.getPresets(),
	});
}

export function useCreatePreset() {
	const queryClient = useQueryClient();

	return useMutation({
		mutationFn: (data: Pick<PresetSummary, "label" | "bucket"> & { isShared?: boolean }) =>
			apiClient.createPreset(data),
		onSuccess: () => {
			queryClient.invalidateQueries({ queryKey: queryKeys.presets });
		},
	});
}

export function useUpdatePreset() {
	const queryClient = useQueryClient();

	return useMutation({
		mutationFn: ({ id, data }: { id: string; data: Partial<Pick<PresetSummary, "label" | "bucket" | "isShared">> }) =>
			apiClient.updatePreset(data, { params: { id } }),
		onSuccess: () => {
			queryClient.invalidateQueries({ queryKey: queryKeys.presets });
		},
	});
}

export function useDeletePreset() {
	const queryClient = useQueryClient();

	return useMutation({
		mutationFn: (id: string) => apiClient.deletePreset(undefined, { params: { id } }),
		onSuccess: () => {
			queryClient.invalidateQueries({ queryKey: queryKeys.presets });
		},
	});
}

// Logs hooks
export function useLogs() {
	return useQuery({
		queryKey: queryKeys.logs,
		queryFn: () => apiClient.getLogs(),
	});
}

export function useCreateLog() {
	const queryClient = useQueryClient();

	return useMutation({
		mutationFn: (data: CreateLog) => apiClient.createLog(data),
		onSuccess: () => {
			queryClient.invalidateQueries({ queryKey: queryKeys.logs });
		},
	});
}

export function useDeleteLog() {
	const queryClient = useQueryClient();

	return useMutation({
		mutationFn: (id: string) => apiClient.deleteLog(undefined, { params: { id } }),
		onSuccess: () => {
			queryClient.invalidateQueries({ queryKey: queryKeys.logs });
		},
	});
}

// Invites hooks
export function useInvites() {
	return useQuery({
		queryKey: queryKeys.invites,
		queryFn: () => apiClient.getInvites(),
	});
}

export function useCreateInvite() {
	const queryClient = useQueryClient();

	return useMutation({
		mutationFn: (data?: { role?: "DICTATOR" | "APPROVER" | "DOER" }) => apiClient.createInvite(data ?? {}),
		onSuccess: () => {
			queryClient.invalidateQueries({ queryKey: queryKeys.invites });
		},
	});
}

export function useDeleteInvite() {
	const queryClient = useQueryClient();

	return useMutation({
		mutationFn: (id: string) => apiClient.deleteInvite(undefined, { params: { id } }),
		onSuccess: () => {
			queryClient.invalidateQueries({ queryKey: queryKeys.invites });
		},
	});
}

// Households hooks
export function useHouseholds() {
	return useQuery({
		queryKey: queryKeys.households,
		queryFn: () => apiClient.getHouseholds(),
	});
}

export function useCreateHousehold() {
	const queryClient = useQueryClient();

	return useMutation({
		mutationFn: (data: { name: string }) => apiClient.createHousehold(data),
		onSuccess: () => {
			queryClient.invalidateQueries({ queryKey: queryKeys.households });
		},
	});
}

// Assigned tasks hooks
export function useAssignedTasks() {
	return useQuery({
		queryKey: queryKeys.assignedTasks,
		queryFn: () => apiClient.getAssignedTasks(),
	});
}

export function useCreateAssignedTask() {
	const queryClient = useQueryClient();

	return useMutation({
		mutationFn: (data: { title: string; description?: string; points: number; assignedToId: string }) =>
			apiClient.createAssignedTask(data),
		onSuccess: () => {
			queryClient.invalidateQueries({ queryKey: queryKeys.assignedTasks });
		},
	});
}
