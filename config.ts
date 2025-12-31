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

	// ADMIN
	superAdminEmail: process.env.SUPER_ADMIN_EMAIL,
	superAdminPassword: process.env.SUPER_ADMIN_PASSWORD,

	// HOUSEHOLDS
	inviteExpiryDays: 14,
	joinRateLimitWindowMs: 60_000, // 1 minute
	joinRateLimitMax: 5,
};
