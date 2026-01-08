import { createServer } from "node:http";
import { Readable } from "node:stream";

// eslint-disable-next-line import/no-named-default
import server from "../dist/server/server.js";

const PORT = process.env.PORT ? Number(process.env.PORT) : 3000;
const HOST = process.env.HOST ?? "0.0.0.0";

const handler = server?.fetch ?? server;

if (typeof handler !== "function") {
	console.error("Invalid server entry: expected a fetch handler export from dist/server/server.js");
	process.exit(1);
}

createServer(async (req, res) => {
	try {
		const url = new URL(req.url || "/", `http://${req.headers.host}`);
		const body = req.method === "GET" || req.method === "HEAD" ? undefined : req;
		const request = new Request(url, {
			method: req.method,
			headers: req.headers,
			body,
			duplex: body ? "half" : undefined,
		});

		const response = await handler(request);

		res.writeHead(response.status, Object.fromEntries(response.headers.entries()));

		if (!response.body) {
			res.end();
			return;
		}

		const nodeStream = Readable.fromWeb(response.body);
		nodeStream.on("error", (error) => {
			console.error("Error streaming response", error);
			res.destroy(error);
		});
		nodeStream.pipe(res);
	} catch (error) {
		console.error("Unhandled error in request handler", error);
		res.statusCode = 500;
		res.end("Internal Server Error");
	}
}).listen(PORT, HOST, () => {
	console.log(`Server listening on http://${HOST}:${PORT}`);
});
