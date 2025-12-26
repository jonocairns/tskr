import "server-only";

type DashboardEvent = {
	type: "dashboard:update";
	at: string;
	householdId?: string | null;
};

type DashboardHandler = (event: DashboardEvent) => void;

declare global {
	var dashboardEventHandlers: Set<DashboardHandler> | undefined;
}

const handlers =
	globalThis.dashboardEventHandlers ?? new Set<DashboardHandler>();

if (!globalThis.dashboardEventHandlers) {
	globalThis.dashboardEventHandlers = handlers;
}

export const publishDashboardUpdate = (householdId?: string | null) => {
	const event: DashboardEvent = {
		type: "dashboard:update",
		at: new Date().toISOString(),
		householdId: householdId ?? null,
	};

	for (const handler of handlers) {
		try {
			handler(event);
		} catch (error) {
			handlers.delete(handler);
			console.error("[events] dashboard handler failed", error);
		}
	}
};

export const subscribeToDashboardUpdates = (handler: DashboardHandler) => {
	handlers.add(handler);

	return () => {
		handlers.delete(handler);
	};
};
