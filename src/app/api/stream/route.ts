import { getServerSession } from "next-auth";

import { authOptions } from "@/lib/auth";
import { subscribeToDashboardUpdates } from "@/lib/events";
import { getHouseholdMembership } from "@/lib/households";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const KEEPALIVE_MS = 20000;

export async function GET(req: Request) {
	const session = await getServerSession(authOptions);
	if (!session?.user?.id) {
		return new Response("Unauthorized", { status: 401 });
	}

	const url = new URL(req.url);
	const householdId = url.searchParams.get("householdId");

	if (!householdId) {
		return new Response("householdId query parameter is required", { status: 400 });
	}

	const membership = await getHouseholdMembership(session.user.id, householdId);
	if (!membership) {
		return new Response("Access denied to household", { status: 403 });
	}
	const encoder = new TextEncoder();
	let isClosed = false;
	let cleanup: (() => void) | null = null;
	let abortHandler: (() => void) | null = null;

	const stream = new ReadableStream<Uint8Array>({
		start(controller) {
			const send = (payload: string) => {
				controller.enqueue(encoder.encode(payload));
			};
			const sendEvent = (event: string, data: unknown) => {
				send(`event: ${event}\n`);
				send(`data: ${JSON.stringify(data)}\n\n`);
			};

			const unsubscribe = subscribeToDashboardUpdates((payload) => {
				if (!payload.householdId) {
					return;
				}
				if (payload.householdId !== householdId) {
					return;
				}
				sendEvent("dashboard", payload);
			});

			sendEvent("ready", { at: new Date().toISOString() });

			const keepalive = setInterval(() => {
				send(": ping\n\n");
			}, KEEPALIVE_MS);

			const close = () => {
				if (isClosed) {
					return;
				}

				isClosed = true;
				if (abortHandler) {
					req.signal.removeEventListener("abort", abortHandler);
				}
				clearInterval(keepalive);
				unsubscribe();
				controller.close();
			};

			cleanup = close;
			abortHandler = () => close();
			req.signal.addEventListener("abort", abortHandler);
		},
		cancel() {
			cleanup?.();
		},
	});

	return new Response(stream, {
		headers: {
			"Content-Type": "text/event-stream",
			"Cache-Control": "no-cache, no-transform",
			Connection: "keep-alive",
		},
	});
}
