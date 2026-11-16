# Tasks hub

Use **task** as the user-facing noun. **Open** means no assignee; **Quick log** identifies an ad-hoc preset or timed completion without an assigned task.

The Tasks hub at `/[householdId]/tasks` has URL tabs: **To do** (`tab=todo`, the default) and **Done** (`tab=done`). The approver-only **Manage** tab (`tab=manage`) creates and edits tasks, lists all ACTIVE tasks including those fulfilled this cycle, and shows progress from full qualifying history. DOER Manage requests fall back to To do before management data loads. Manage ignores range params and hides member/range controls. Member selection and range params survive tab switches. To do shares the dashboard derivation and full completion history, independent of the display range; a member sees their assigned tasks plus Open tasks. Done filters by completer and defaults to the household calendar week. Done and the weekly dashboard count include quick-log completions.

`/week` redirects to `/tasks`, forwarding every query param and selecting Done when `preset`, `from`, or `to` is present. `/assignments` redirects approvers to `/tasks?tab=manage` and DOERs to `/tasks`.

The empty-household rule shows the dashboard card when the user is an approver, there are active tasks, or done this week is greater than zero.

PR sequence:

1. #168: task wording and inline preset creation.
2. #169: Tasks page with To do and Done tabs.
3. Implemented in this branch: Manage tab, `/assignments` redirect, and empty-household visibility.
4. Rename the dashboard preset grid to Quick log.
