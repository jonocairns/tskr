import "server-only";

import { router } from "@/server/trpc";
import { adminRouter } from "./admin";
import { assignedTasksRouter } from "./assignedTasks";
import { claimRouter } from "./claim";
import { healthRouter } from "./health";
import { householdsRouter } from "./households";
import { logsRouter } from "./logs";

export const appRouter = router({
	admin: adminRouter,
	assignedTasks: assignedTasksRouter,
	claim: claimRouter,
	health: healthRouter,
	households: householdsRouter,
	logs: logsRouter,
});

export type AppRouter = typeof appRouter;
