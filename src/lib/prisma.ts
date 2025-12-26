import { PrismaBetterSqlite3 } from "@prisma/adapter-better-sqlite3";
import { PrismaClient } from "@prisma/client";

import { publishDashboardUpdate } from "@/lib/events";

const globalForPrisma = globalThis as unknown as {
	prisma: ReturnType<typeof createPrismaClient> | undefined;
};

const databaseUrl = process.env.DATABASE_URL ?? "file:./prisma/dev.db";
const adapter = new PrismaBetterSqlite3({
	url: databaseUrl,
});

const DASHBOARD_MODELS = new Set(["AssignedTask", "PointLog", "PresetTask"]);
const DASHBOARD_ACTIONS = new Set([
	"create",
	"createMany",
	"update",
	"updateMany",
	"upsert",
	"delete",
	"deleteMany",
]);

const createPrismaClient = () => {
	const client = new PrismaClient({ adapter, log: ["warn", "error"] });

	return client.$extends({
		query: {
			$allModels: {
				async $allOperations({ model, operation, args, query }) {
					const result = await query(args);

					if (
						model &&
						DASHBOARD_MODELS.has(model) &&
						DASHBOARD_ACTIONS.has(operation)
					) {
						const householdId =
							result &&
							typeof result === "object" &&
							"householdId" in result &&
							typeof (result as { householdId?: unknown }).householdId ===
								"string"
								? (result as { householdId: string }).householdId
								: null;
						publishDashboardUpdate(householdId);
					}

					return result;
				},
			},
		},
	});
};

const hasHouseholdRewardThreshold = (
	client: ReturnType<typeof createPrismaClient>,
) => {
	const runtime = (client as { _runtimeDataModel?: unknown })
		._runtimeDataModel as
		| {
				models?: Record<string, { fields?: Array<{ name?: string }> }>;
		  }
		| undefined;
	const fields = runtime?.models?.Household?.fields ?? [];
	return Array.isArray(fields)
		? fields.some((field) => field.name === "rewardThreshold")
		: false;
};

const hasAssignedTaskModel = (
	client: ReturnType<typeof createPrismaClient>,
) => {
	const runtime = (client as { _runtimeDataModel?: unknown })
		._runtimeDataModel as
		| {
				models?: Record<string, { fields?: Array<{ name?: string }> }>;
		  }
		| undefined;
	return Boolean(runtime?.models?.AssignedTask) && "assignedTask" in client;
};

const existingClient = globalForPrisma.prisma;
const prisma =
	existingClient &&
	"householdMember" in existingClient &&
	hasHouseholdRewardThreshold(existingClient) &&
	hasAssignedTaskModel(existingClient)
		? existingClient
		: createPrismaClient();

export { prisma };

if (process.env.NODE_ENV !== "production") {
	globalForPrisma.prisma = prisma;
}
