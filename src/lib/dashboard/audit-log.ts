import type { AuditLogEntry } from "@/components/AuditLog";
import {
	DURATION_BUCKETS,
	type DurationKey,
	LOG_KINDS,
	type LogKind,
} from "@/lib/points";

type RecentLog = {
	id: string;
	description: string;
	points: number;
	kind: string;
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

		return {
			id: log.id,
			userName: log.user?.name ?? log.user?.email ?? "Unknown",
			description: log.description,
			points: log.points,
			kind,
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
