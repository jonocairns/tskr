import { findDuplicateTask } from "@/lib/tasks/duplicates";

const member = { presetId: "vacuum", presetLabel: "Vacuum", assigneeId: "sam" };
const open = { ...member, assigneeId: null };

test("matches the selected task for the same member", () => {
	expect(findDuplicateTask({ tasks: [member], presetId: "vacuum", label: "", assigneeId: "sam" })).toBe(member);
});
test("matches the selected Open task", () => {
	expect(findDuplicateTask({ tasks: [open], presetId: "vacuum", label: "", assigneeId: null })).toBe(open);
});
test("does not match another assignee or preset", () => {
	expect(findDuplicateTask({ tasks: [member], presetId: "vacuum", label: "", assigneeId: "alex" })).toBeUndefined();
	expect(findDuplicateTask({ tasks: [member], presetId: "other", label: "Vacuum", assigneeId: "sam" })).toBeUndefined();
	expect(findDuplicateTask({ tasks: [member], presetId: "vacuum", label: "", assigneeId: null })).toBeUndefined();
});
test.each(["Vacuum", "  vAcUuM  "])("matches a new label %s for the same assignee", (label) => {
	expect(
		findDuplicateTask({ tasks: [{ ...member, presetLabel: " Vacuum " }], presetId: null, label, assigneeId: "sam" }),
	).toBeDefined();
	expect(findDuplicateTask({ tasks: [open], presetId: null, label, assigneeId: null })).toBe(open);
	expect(findDuplicateTask({ tasks: [member], presetId: null, label, assigneeId: "alex" })).toBeUndefined();
});
test("does not match blank or different new labels", () => {
	for (const label of ["", "   ", "Laundry"]) {
		expect(findDuplicateTask({ tasks: [member], presetId: null, label, assigneeId: "sam" })).toBeUndefined();
	}
});
