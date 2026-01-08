import { createServer } from "@hattip/adapter-node";
// eslint-disable-next-line import/no-named-default
import server from "../dist/server/server.js";

const PORT = process.env.PORT ? Number(process.env.PORT) : 3000;
const HOST = process.env.HOST ?? "0.0.0.0";

const handler = server?.fetch ?? server;

if (typeof handler !== "function") {
	console.error("Invalid server entry: expected a fetch handler export from dist/server/server.js");
	process.exit(1);
}

const app = createServer(async (ctx) => {
	return handler(ctx.request);
});

app.listen(PORT, HOST, () => {
	console.log(`Server listening on http://${HOST}:${PORT}`);
});
