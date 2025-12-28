import { buildAuditEntries } from "../src/lib/dashboard/buildAuditEntries";

type RecentLog = Parameters<typeof buildAuditEntries>[0][number];

const makeLog = (overrides: Partial<RecentLog> = {}): RecentLog => ({
	id: "log-1",
	userId: "user-1",
	description: "Did the thing",
	points: 5,
	kind: "PRESET",
	status: null,
	duration: "QUICK",
	createdAt: new Date("2024-01-01T00:00:00.000Z"),
	revertedAt: null,
	user: { name: "Sam", email: "sam@example.com" },
	...overrides,
});

test("normalizes status and maps duration buckets", () => {
	const entry = buildAuditEntries([makeLog({ kind: "TIMED", status: "PENDING", duration: "QUICK" })])[0];

	expect(entry?.kind).toBe("TIMED");
	expect(entry?.status).toBe("PENDING");
	expect(entry?.bucketLabel).toBe("Quick");
	expect(entry?.createdAt).toBe("2024-01-01T00:00:00.000Z");
});

test("defaults invalid kind/status and handles missing duration", () => {
	const entry = buildAuditEntries([makeLog({ kind: "UNKNOWN", status: "OTHER", duration: null, user: null })])[0];

	expect(entry?.kind).toBe("PRESET");
	expect(entry?.status).toBe("APPROVED");
	expect(entry?.bucketLabel).toBeNull();
	expect(entry?.userName).toBe("Unknown");
});

test("overrides bucket label for rewards", () => {
	const entry = buildAuditEntries([makeLog({ kind: "REWARD", status: "REJECTED", duration: "QUICK" })])[0];

	expect(entry?.kind).toBe("REWARD");
	expect(entry?.status).toBe("REJECTED");
	expect(entry?.bucketLabel).toBe("Reward");
});
