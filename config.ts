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
};
