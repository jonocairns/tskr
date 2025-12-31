import "server-only";

/**
 * Sanitizes error messages to prevent information leakage.
 *
 * In production, we want to hide internal implementation details that could
 * help attackers. Messages like "Household not found" vs "Forbidden" could
 * help an attacker enumerate valid household IDs.
 *
 * This is a balance between security and developer experience:
 * - Development: Show detailed error messages for debugging
 * - Production: Show generic messages but preserve error codes
 */

const isDev = process.env.NODE_ENV !== "production";

/**
 * Maps internal error messages to safe, generic messages for production.
 * Preserves the error code so clients can handle different error types.
 */
export function sanitizeErrorMessage(message: string, code: string): string {
	// In development, return the original message for debugging
	if (isDev) {
		return message;
	}

	// In production, use generic messages based on error code
	switch (code) {
		case "UNAUTHORIZED":
			return "Authentication required";

		case "FORBIDDEN":
			// Generic message - don't reveal whether resource exists
			return "Access denied";

		case "NOT_FOUND":
			// Generic message - don't reveal what wasn't found
			return "Resource not found";

		case "BAD_REQUEST":
			// Keep validation messages, but sanitize others
			if (
				message.includes("validation") ||
				message.includes("invalid") ||
				message.includes("required") ||
				message.includes("too short") ||
				message.includes("too long")
			) {
				return message;
			}
			return "Invalid request";

		case "CONFLICT":
			// Generic message for conflicts
			return "Resource already exists";

		case "INTERNAL_SERVER_ERROR":
			// Never expose internal error details
			return "An internal error occurred";

		case "PAYLOAD_TOO_LARGE":
			return "Request payload too large";

		case "TOO_MANY_REQUESTS":
			return "Too many requests, please try again later";

		default:
			return "An error occurred";
	}
}

/**
 * Checks if an error message might leak sensitive information.
 * Used in development to warn about potential information leakage.
 */
export function checkForSensitiveInfo(message: string): string[] {
	const warnings: string[] = [];

	// Check for common patterns that might leak info
	const patterns = [
		{ regex: /user(?:id|Id|ID)?\s*[:=]\s*['"]?[\w-]+['"]?/i, warning: "Contains user ID" },
		{ regex: /household(?:id|Id|ID)?\s*[:=]\s*['"]?[\w-]+['"]?/i, warning: "Contains household ID" },
		{ regex: /email\s*[:=]\s*['"]?[\w.@+-]+['"]?/i, warning: "Contains email address" },
		{ regex: /password|secret|token/i, warning: "Contains sensitive keyword" },
		{ regex: /\b\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}\b/, warning: "Contains IP address" },
	];

	for (const { regex, warning } of patterns) {
		if (regex.test(message)) {
			warnings.push(warning);
		}
	}

	return warnings;
}
