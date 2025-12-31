import "server-only";

import { router } from "@/server/trpc";
import { adminRouter } from "./admin";
import { assignedTasksRouter } from "./assignedTasks";
import { claimRouter } from "./claim";
import { healthRouter } from "./health";
import { householdsRouter } from "./households/index";
import { logsRouter } from "./logs";
import { passwordResetRouter } from "./passwordReset";
import { presetsRouter } from "./presets";
import { pushRouter } from "./push";

export const appRouter = router({
	admin: adminRouter,
	assignedTasks: assignedTasksRouter,
	claim: claimRouter,
	health: healthRouter,
	households: householdsRouter,
	logs: logsRouter,
	passwordReset: passwordResetRouter,
	presets: presetsRouter,
	push: pushRouter,
});

export type AppRouter = typeof appRouter;
