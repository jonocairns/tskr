/**
 * Validates session expiry and idle timeout.
 *
 * Sessions can expire in two ways:
 * 1. Absolute expiry: Session is older than maxAge (30 days)
 * 2. Idle timeout: No activity for longer than idleTimeout (24 hours)
 *
 * This provides defense-in-depth against session hijacking and ensures
 * inactive sessions don't remain valid indefinitely.
 */
export interface SessionTimestamps {
	iat?: number; // Issued at (Unix timestamp in seconds)
	lastActivity?: number; // Last activity timestamp (Unix timestamp in seconds)
}

const DEFAULT_SESSION_MAX_AGE = 30 * 24 * 60 * 60;
const DEFAULT_SESSION_IDLE_TIMEOUT = 24 * 60 * 60;

export const getSessionTimestamps = (session: {
	session?: { createdAt?: Date | string; updatedAt?: Date | string | null };
} | null): SessionTimestamps => {
	const createdAt = session?.session?.createdAt;
	if (!createdAt) {
		return {};
	}
	const createdAtMs = new Date(createdAt).getTime();
	if (!Number.isFinite(createdAtMs)) {
		return {};
	}

	const updatedAt = session?.session?.updatedAt ?? null;
	const updatedAtMs = updatedAt ? new Date(updatedAt).getTime() : null;

	return {
		iat: Math.floor(createdAtMs / 1000),
		lastActivity: updatedAtMs ? Math.floor(updatedAtMs / 1000) : undefined,
	};
};

export const isSessionValid = (session: {
	session?: { createdAt?: Date | string; updatedAt?: Date | string | null };
} | null): boolean => {
	const timestamps = getSessionTimestamps(session);
	return validateSessionExpiry(timestamps).valid;
};

export function validateSessionExpiry(timestamps: SessionTimestamps): {
	valid: boolean;
	reason?: "expired" | "idle_timeout";
} {
	const maxAge = DEFAULT_SESSION_MAX_AGE;
	const idleTimeout = DEFAULT_SESSION_IDLE_TIMEOUT;
	const now = Math.floor(Date.now() / 1000);

	// Check if we have the required timestamps
	if (!timestamps.iat) {
		// If no iat, session is likely corrupted or very old
		return { valid: false, reason: "expired" };
	}

	// Check absolute expiry (maxAge)
	const sessionAge = now - timestamps.iat;
	if (sessionAge > maxAge) {
		return { valid: false, reason: "expired" };
	}

	// Check idle timeout
	if (timestamps.lastActivity) {
		const idleTime = now - timestamps.lastActivity;
		if (idleTime > idleTimeout) {
			return { valid: false, reason: "idle_timeout" };
		}
	}

	return { valid: true };
}
