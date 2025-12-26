import type { AuditLogEntry } from "@/components/AuditLog";
import {
	DURATION_BUCKETS,
	type DurationKey,
	LOG_KINDS,
	type LogKind,
} from "@/lib/points";

type RecentLog = {
	id: string;
	userId: string;
	description: string;
	points: number;
	kind: string;
	status?: string | null;
	duration: string | null;
	createdAt: Date;
	revertedAt: Date | null;
	user?: { name: string | null; email: string | null } | null;
};

const bucketLabelMap = Object.fromEntries(
	DURATION_BUCKETS.map((bucket) => [bucket.key, bucket.label]),
);

const isLogKind = (kind: string): kind is LogKind =>
	LOG_KINDS.includes(kind as LogKind);

export function buildAuditEntries(recentLogs: RecentLog[]): AuditLogEntry[] {
	return recentLogs.map((log) => {
		const kind = isLogKind(log.kind) ? log.kind : "PRESET";
		const status =
			log.status === "PENDING" || log.status === "REJECTED"
				? log.status
				: "APPROVED";

		return {
			id: log.id,
			userId: log.userId,
			userName: log.user?.name ?? log.user?.email ?? "Unknown",
			description: log.description,
			points: log.points,
			kind,
			status,
			bucketLabel:
				kind === "REWARD"
					? "Reward"
					: (log.duration as DurationKey | null)
						? bucketLabelMap[log.duration as DurationKey]
						: null,
			createdAt: log.createdAt.toISOString(),
			revertedAt: log.revertedAt?.toISOString() ?? null,
		};
	});
}
