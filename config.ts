export const baseConfig = {
	// ENV
	isDev: process.env.NODE_ENV !== "production",

	// DB
	databaseUrl: process.env.DATABASE_URL ?? "file:./prisma/dev.db",

	// PUSH
	vapidPublicKey: process.env.VAPID_PUBLIC_KEY,
	vapidPrivateKey: process.env.VAPID_PRIVATE_KEY,
	vapidSubject: process.env.VAPID_SUBJECT ?? "mailto:admin@example.com",

	// AUTH
	googleClientId: process.env.GOOGLE_CLIENT_ID,
	googleClientSecret: process.env.GOOGLE_CLIENT_SECRET,
	appUrl: process.env.NEXTAUTH_URL ?? "http://localhost:3000",
	passwordResetTtlHours: 24,
	sessionMaxAge: 30 * 24 * 60 * 60, // 30 days in seconds
	sessionIdleTimeout: 24 * 60 * 60, // 24 hours in seconds

	// ADMIN
	superAdminEmail: process.env.SUPER_ADMIN_EMAIL,
	superAdminPassword: process.env.SUPER_ADMIN_PASSWORD,

	// HOUSEHOLDS
	inviteExpiryDays: 14,
	joinRateLimitWindowMs: 60_000, // 1 minute
	joinRateLimitMax: 5,

	// SECURITY
	maxRequestBodySize: 1024 * 1024, // 1MB - should be enough for all operations
};
