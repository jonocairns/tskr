const databaseUrl = process.env.DATABASE_URL ?? "file:./prisma/dev.db";

export default {
	schema: "prisma/schema.prisma",
	migrations: {
		path: "prisma/migrations",
	},
	datasource: {
		url: databaseUrl,
	},
};
