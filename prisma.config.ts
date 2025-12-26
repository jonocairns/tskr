import { baseConfig } from "./config";

export default {
	schema: "prisma/schema.prisma",
	migrations: {
		path: "prisma/migrations",
	},
	datasource: {
		url: baseConfig.databaseUrl,
	},
};
