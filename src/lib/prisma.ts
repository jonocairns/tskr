import { PrismaBetterSqlite3 } from "@prisma/adapter-better-sqlite3";
import { PrismaClient } from "@prisma/client";

import { publishDashboardUpdate } from "@/lib/events";
import { config } from "@/server-config";

const globalForPrisma = globalThis as unknown as {
	prisma: ReturnType<typeof createPrismaClient> | undefined;
};

const adapter = new PrismaBetterSqlite3({
	url: config.databaseUrl,
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

const hasHouseholdDashboardFields = (
	client: ReturnType<typeof createPrismaClient>,
) => {
	const runtime = (client as { _runtimeDataModel?: unknown })
		._runtimeDataModel as
		| {
				models?: Record<string, { fields?: Array<{ name?: string }> }>;
		  }
		| undefined;
	const fields = runtime?.models?.Household?.fields ?? [];
	if (!Array.isArray(fields)) {
		return false;
	}
	return ["rewardThreshold", "progressBarColor"].every((requiredField) =>
		fields.some((field) => field.name === requiredField),
	);
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
	hasHouseholdDashboardFields(existingClient) &&
	hasAssignedTaskModel(existingClient)
		? existingClient
		: createPrismaClient();

export { prisma };

if (config.isDev) {
	globalForPrisma.prisma = prisma;
}
