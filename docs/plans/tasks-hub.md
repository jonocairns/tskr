# Tasks hub

Use **task** as the user-facing noun. **Open** means no assignee; **Quick log** means one-tap logging: shared preset taps count towards a matching listed task (own, then Open, then another member's, named in the toast); otherwise they log extra work. Only extra entries retain the Quick log badge in Done.

The Tasks hub at `/[householdId]/tasks` has URL tabs: **To do** (`tab=todo`, the default) and **Done** (`tab=done`). The approver-only **Manage** tab (`tab=manage`) creates and edits tasks, lists all unarchived ACTIVE tasks including those fulfilled this cycle, and shows progress from full qualifying history. DOER Manage requests fall back to To do before management data loads. Manage ignores range params and hides member/range controls. Member selection and range params survive tab switches. To do shares the dashboard derivation and full completion history, independent of the display range; a member sees their assigned tasks plus Open tasks. Done filters by completer and defaults to the household calendar week. Done and the weekly dashboard count include quick-log completions.

`/week` redirects to `/tasks`, forwarding every query param and selecting Done when `preset`, `from`, or `to` is present. `/assignments` redirects approvers to `/tasks?tab=manage` and DOERs to `/tasks`.

The empty-household rule shows the dashboard card when the user is an approver, there are active tasks, or done this week is greater than zero.

PR sequence:

1. #168: task wording and inline preset creation.
2. #169: Tasks page with To do and Done tabs.
3. #170: Manage tab, `/assignments` redirect, and empty-household visibility.
4. #171: dashboard Quick log grid, task wording in its controls and toasts, and listed-task guidance.
5. PR 5: archive removed tasks, preserve Done provenance, protect Manage drafts from live refresh, prune inline-created picker entries, show all tasks for a selected member, and polish task-list and quick-log deletion copy.

6. PR 6: Quick log taps count towards matching listed tasks. Matching checks current-cycle capacity under the transaction write lock, ordered by oldest assignedAt then id within each tier. No confirmation; the toast names another member's task; revert from History. Personal presets, timed work and built-in preset keys never match. Completion writing and after-commit notifications are shared with To do.

Removing a task sets `AssignedTask.archivedAt` and excludes it from current-task lists. Its completions remain linked in Done, including the assignee; subsequent log status changes never un-archive it. Manage disables live refresh to protect unsaved drafts.

Known limitation: deleting a quick-log preset still cascades to its tasks and clears their completion links. The quick-log deletion dialog lists affected current tasks and expands its title when the task list is affected.

A matched Quick log tap writes the same completion as To do, except that a typed note is kept as the log's description (otherwise the task name is used); the task link and "Assigned to" are unaffected.

Add task warns softly about a same-task, same-assignee duplicate using Manage props.
