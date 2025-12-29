const databaseUrl = process.env.DATABASE_URL ?? "file:./prisma/dev.db";

export default {
	schema: "prisma/schema.prisma",
	migrations: {
		path: "prisma/migrations",
		seed: "node ./scripts/db-bootstrap.cjs",
	},
	datasource: {
		url: databaseUrl,
	},
};
