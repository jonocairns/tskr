import "server-only";

import { config } from "@/server-config";

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

export function validateSessionExpiry(timestamps: SessionTimestamps): {
	valid: boolean;
	reason?: "expired" | "idle_timeout";
} {
	const now = Math.floor(Date.now() / 1000);

	// Check if we have the required timestamps
	if (!timestamps.iat) {
		// If no iat, session is likely corrupted or very old
		return { valid: false, reason: "expired" };
	}

	// Check absolute expiry (maxAge)
	const sessionAge = now - timestamps.iat;
	if (sessionAge > config.sessionMaxAge) {
		return { valid: false, reason: "expired" };
	}

	// Check idle timeout
	if (timestamps.lastActivity) {
		const idleTime = now - timestamps.lastActivity;
		if (idleTime > config.sessionIdleTimeout) {
			return { valid: false, reason: "idle_timeout" };
		}
	}

	return { valid: true };
}
