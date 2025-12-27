import assert from "node:assert/strict";
import { test } from "node:test";

import {
	publishDashboardUpdate,
	subscribeToDashboardUpdates,
} from "../src/lib/events-core.ts";

test("publishes dashboard updates to subscribers", () => {
	let calls = 0;
	const unsubscribe = subscribeToDashboardUpdates((event) => {
		calls += 1;
		assert.equal(event.type, "dashboard:update");
		assert.equal(event.householdId, "house-1");
	});

	publishDashboardUpdate("house-1");
	unsubscribe();
	publishDashboardUpdate("house-1");

	assert.equal(calls, 1);
});

test("removes handlers that throw", () => {
	const originalError = console.error;
	console.error = () => {};
	try {
		let calls = 0;
		const handler = () => {
			calls += 1;
			throw new Error("boom");
		};
		subscribeToDashboardUpdates(handler);

		publishDashboardUpdate("house-1");
		publishDashboardUpdate("house-1");

		assert.equal(calls, 1);
	} finally {
		console.error = originalError;
	}
});
