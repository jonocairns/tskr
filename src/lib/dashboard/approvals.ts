import type { ApprovalEntry } from "@/components/ApprovalQueue";

type PendingLog = {
	id: string;
	userId: string;
	description: string;
	points: number;
	createdAt: Date;
	user?: { name: string | null; email: string | null } | null;
};

export function buildApprovalEntries(pendingLogs: PendingLog[]): ApprovalEntry[] {
	return pendingLogs.map((log) => ({
		id: log.id,
		userId: log.userId,
		userName: log.user?.name ?? log.user?.email ?? "Unknown",
		description: log.description,
		points: log.points,
		createdAt: log.createdAt.toISOString(),
	}));
}
