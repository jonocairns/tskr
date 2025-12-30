import "server-only";

import { router } from "@/server/trpc";
import { householdsRouter } from "./households";
import { logsRouter } from "./logs";

export const appRouter = router({
	households: householdsRouter,
	logs: logsRouter,
});

export type AppRouter = typeof appRouter;
