import { publishDashboardUpdate, subscribeToDashboardUpdates } from "../src/lib/events-core";

test("publishes dashboard updates to subscribers", () => {
	let calls = 0;
	const unsubscribe = subscribeToDashboardUpdates((event) => {
		calls += 1;
		expect(event.type).toBe("dashboard:update");
		expect(event.householdId).toBe("house-1");
	});

	publishDashboardUpdate("house-1");
	unsubscribe();
	publishDashboardUpdate("house-1");

	expect(calls).toBe(1);
});

test("removes handlers that throw", () => {
	const errorSpy = jest.spyOn(console, "error").mockImplementation(() => {});
	try {
		let calls = 0;
		const handler = () => {
			calls += 1;
			throw new Error("boom");
		};
		subscribeToDashboardUpdates(handler);

		publishDashboardUpdate("house-1");
		publishDashboardUpdate("house-1");

		expect(calls).toBe(1);
	} finally {
		errorSpy.mockRestore();
	}
});
