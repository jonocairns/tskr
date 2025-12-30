import "server-only";

import { publicProcedure, router } from "@/server/trpc";

export const healthRouter = router({
	check: publicProcedure.query(() => {
		return { status: "ok" };
	}),
});
