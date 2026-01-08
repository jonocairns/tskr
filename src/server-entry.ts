import type { Register } from "@tanstack/react-router";
import type { RequestHandler } from "@tanstack/react-start/server";
import { createStartHandler, defaultStreamHandler } from "@tanstack/react-start/server";

import { getStartContext } from "@tanstack/start-storage-context";

const fetch = createStartHandler(({ request, router, responseHeaders }) => {
	const startContext = getStartContext({ throwIfNotFound: false });
	const nonce = (startContext?.contextAfterGlobalMiddlewares as { cspNonce?: string } | undefined)?.cspNonce;

	if (nonce) {
		router.update({ ssr: { nonce } });
	}

	return defaultStreamHandler({ request, router, responseHeaders });
});

export type ServerEntry = { fetch: RequestHandler<Register> };

export function createServerEntry(entry: ServerEntry): ServerEntry {
	return {
		async fetch(request, opts) {
			return await entry.fetch(request, opts);
		},
	};
}

export default createServerEntry({ fetch });
