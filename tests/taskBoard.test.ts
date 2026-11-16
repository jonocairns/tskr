import { shouldShowTaskBoard } from "@/lib/dashboard/taskBoard";

describe.each(["APPROVER", "DICTATOR", "DOER"] as const)("%s dashboard board visibility", (role) => {
	test.each([
		[false, 0],
		[false, 1],
		[true, 0],
		[true, 1],
	] as const)("active=%s, done=%s", (active, done) => {
		const expected = role === "DOER" ? active || done > 0 : true;
		expect(shouldShowTaskBoard(role, active, done)).toBe(expected);
	});
});
