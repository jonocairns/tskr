# Tasks hub

Use **task** as the user-facing noun. **Open** means no assignee; **Quick log** identifies an ad-hoc preset or timed completion without an assigned task.

The Tasks hub at `/[householdId]/tasks` has URL tabs: **To do** (`tab=todo`, the default) and **Done** (`tab=done`). An approver-only **Manage** tab will follow. Member selection and range params survive tab switches. To do shares the dashboard derivation and full completion history, independent of the display range; a member sees their assigned tasks plus Open tasks. Done filters by completer and defaults to the household calendar week. Done and the weekly dashboard count include quick-log completions.

`/week` redirects to `/tasks`, forwarding every query param and selecting Done when `preset`, `from`, or `to` is present. Later, `/assignments` will redirect to `/tasks?tab=manage`.

The later empty-household rule will show the dashboard card when the user is an approver, there are active tasks, or done this week is greater than zero. This PR retains the existing visibility rule.

PR sequence:

1. #168: task wording and inline preset creation.
2. This PR: Tasks page with To do and Done tabs.
3. Manage tab, `/assignments` redirect, and empty-household visibility.
4. Rename the dashboard preset grid to Quick log.
