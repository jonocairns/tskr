# Shared task board

Planned 2026-11-15 against `18ccfd7`, reconciled the same day against `a9567c8` (after #155, #156, #158, #159; reviewed by Fable). References use `path:line` at `a9567c8`.

**Goal:** a household can see its to-do tasks in a shared space, and anyone can do them.

Sized for how tskr runs: one container, one Node process (`Dockerfile:70`), one SQLite file. Process-local SSE and rate limiting already rule out multiple instances, so no extra concurrency hardening beyond what is listed.

## 1. Scope

### v1

- Every assigned task is visible to every household member. The dashboard groups them Yours / Open / Everyone else's.
- The assignee is optional. Only approvers (APPROVER/DICTATOR) create, assign, reassign or unassign tasks.
- Anyone can complete any task. The completer gets the points.
- The week view becomes the household's task list, with an Everyone/member filter remembered per browser and a calendar-week default.
- Existing assignments migrate unchanged.

### Not in v1

- Claiming, holds or locks; bounties.
- Free-text items, lists or big cleans, templates. Tasks created by DOERs. Changes to personal presets.
- Reversed by Tasks hub PR 6: shared Quick log preset taps match listed tasks (own, then Open, then another member's after confirmation).
- A shared "outstanding work" helper for the dashboard and week view.

## 2. Already on main (#156)

No further work needed:

- `assignedTasks.complete` runs in one transaction behind `lockAssignedTask`, checks capacity with `ensureAssignedTaskCapacity` at a shared `completedAt`, and throws `BAD_REQUEST` ("Task already completed for this cadence") instead of a server error (`src/server/routers/assignedTasks.ts:142-211`, `src/server/assignedTaskState.ts`).
- `logs.updateStatus` takes the write lock first; approve/reject check `PENDING` inside the transaction; resubmit re-checks capacity in the original `createdAt` window and recomputes task status (`src/server/routers/logs.ts:221-347`).
- `assignedTasks.update` normalises `cadenceTarget` to 1 for one-offs and recomputes status in a locked transaction (`assignedTasks.ts:93-118`), so switching a completed recurring task to one-off now marks it COMPLETED.
- Week-view eligibility uses each task's full, household-wide log history (`task.logs`), not the display range (`src/lib/week-view/queries.ts:84-87`, `buildTimeline.ts:317`).
- Dashboard shows "Completed last cycle", "Last completed" and "Resets" (`src/lib/dashboard/assigned.ts:47-63`).
- A DB-backed router test harness exists (`tests/assignedTasksRouter.test.ts`); new server tests go there.

## 3. Server

### 3.1 Completion

- Remove the assignee check (`assignedTasks.ts:159-161`). `householdProcedure` already enforces membership. Approval still follows the completer's membership default and the preset override.
- After commit, push to the household excluding the actor (`broadcastPush`, `src/lib/push.ts:35`): "X completed Bins" or "X completed Bins, awaiting approval", naming the assignee when it is someone else ("X completed Sam's Bins").

### 3.2 Create and update

- `create`: `assigneeId` nullable; membership check only when set. Only shared presets (`isShared: true`). Existing tasks on personal presets keep working and display as they are.
- `update`: optional nullable `assigneeId` (absent = unchanged, `null` = unassign; membership check when set). Allow an assignee-only update through the "No updates provided" refine (`assignedTasks.ts:29-33`).
- `presets.update` (`src/server/routers/presets.ts:116`): reject un-sharing a preset while any ACTIVE task references it.
- `presets.delete` (`presets.ts:193`) stays. A small usage query returns a preset's active tasks so the delete confirmation can name them ("This will also remove: Bins (Sam), Vacuum lounge (Open)").

## 4. Schema and migration

```prisma
model AssignedTask {
  assignedToId String?
  assignedTo   User?   @relation("AssignedTo", fields: [assignedToId], references: [id], onDelete: SetNull)
  assignedById String?
  assignedBy   User?   @relation("AssignedBy", fields: [assignedById], references: [id], onDelete: SetNull)
}
```

- Deleting a user unassigns their tasks; deleting the approver who created a task keeps it.
- SQLite rebuilds `AssignedTask` (`prisma/schema.prisma:393-414`). Prisma's generated `PRAGMA foreign_keys=OFF` bracket keeps `PointLog.assignedTaskId` links intact, as in earlier rebuilds (`20260206034502_add_household_date_time_format`).
- Verification: review the SQL by hand (pragma bracket, `INSERT ... SELECT` copying `id`, indexes recreated), then run it on a copy of a seeded database and compare the count of non-null `PointLog.assignedTaskId` before and after.

## 5. Dashboard

- Load all household tasks (drop `assignedToId: userId`, `src/lib/dashboard/queries.ts:131`), with assignee, and log `status` and completer.
- `buildAssignedTaskEntries` (`src/lib/dashboard/assigned.ts`) adds a group (`mine` / `open` / `others`) and a state:
  - `available`: can be completed now.
  - `awaitingApproval`: capacity full with a pending completion, shown as "Awaiting approval, done by X". Today these rows disappear (`assigned.ts:42`).
  - Met-and-approved periods and completed one-offs stay omitted.
- `AssignedTaskQueue`: Yours, Open, Everyone else's (the last collapsed when long). Move remaining hard-coded strings to `t()`.
- Completing someone else's task asks for confirmation; Open tasks and your own complete in one tap. A stale tap (`BAD_REQUEST`) shows the message and refreshes.
- Show the board when the household has any active task or N > 0 (`src/app/[householdId]/page.tsx:97`).
- **Done link:** "N done this week →" to the week view with `?preset=calendarWeek&userId=all`. N counts household PRESET/TIMED, unreverted, PENDING + APPROVED logs since the household week start. Shown whenever N > 0.

## 6. Assignments page

- `AssignTaskCard`: "Unassigned" option; shared presets only.
- `AssignedTasksManager`: per-row assignee selector including "Unassigned".

## 7. Week view

- **Filter:** "Everyone" (default) or one member.
  - Member M: to-do shows tasks assigned to M plus Open tasks; completed shows M's completions.
  - Everyone: all tasks and all completions, labelled with assignee ("Open" if none) and completer.
- **Remembered per browser:** a long-lived per-household cookie, read during server rendering. Resolution: valid `?userId=` (member id or `all`), then a valid cookie, then Everyone. Picking a member writes the cookie. Range and member links always include `userId` (today the builder omits it for yourself, `src/components/WeekViewRangeControls.tsx:51`).
- **Calendar week:** a new `calendarWeek` preset labelled "This week", from the household week start to the next (`getStartOfWeekInTimeZone`, `src/lib/timeZones.ts:213`), used as the default. Existing keys keep parsing and are relabelled "Last 7 days", "Last 14 days", "Last month" (`buildTimeline.ts:5`).
- **Tasks query:** drop `assignedToId: userId` (`week-view/queries.ts:75`) and filter as above. Completed-log query filters by the selected member, or none for Everyone, and includes the completer's name.
- **One-off fix:** emit an ACTIVE one-off with no counted completion even if `assignedAt` is before the range, displayed at the range start (`buildTimeline.ts:210`).
- Anyone can complete any to-do entry: drop `canCompletePlannedEntries={viewingSelf}` (`src/app/[householdId]/week/page.tsx:125`), with the dashboard's confirmation for someone else's task.
- Rename "Planned" to "To do"; retitle the page "Household tasks". No projected future occurrences; the `canComplete` filter stays (`buildTimeline.ts:331`).

## 8. Decisions

Settled by the user on 2026-11-15:

| Question | Answer |
| --- | --- |
| Claiming, locks, bounties | Not in v1 |
| Who creates and assigns tasks | Approvers only |
| Who can complete | Anyone; the completer gets the points |
| Personal presets | Unchanged; new board tasks use shared presets; existing tasks on personal presets shown as they are |
| Un-sharing a preset used by tasks | Blocked |
| Deleting a preset used by tasks | Allowed, with a warning naming the tasks |
| Undo | Unchanged: the completer or an approver |
| Approval, including sole-approver households | Unchanged |
| Push recipients | Whole household excluding the actor |
| Finished work | In the week view; the dashboard keeps "Awaiting approval" rows and a done link |
| Week view | Household list, member filter remembered per browser, Open tasks shown under a member filter, complete from any view |
| "This week" | Calendar-week preset, default |
| Confirm when completing someone else's task | Yes |

## 8a. Implementation notes

- **Push after commit:** `complete` returns the transaction directly (`assignedTasks.ts:147`). Restructure it so the push runs after commit, guarded and with errors swallowed as in `logs.ts:83-91`. Load `assignedTo.name` in the transaction query and use `getServerT` for the copy.
- **Reassignment** goes through the existing locked `update` transaction, with the membership check on `tx` (AGENTS.md lock-before-read rule). Create and the un-share block touch no capacity and need no lock.
- **Done link:** dashboard `weekStart` is a rolling 7 days in server time (`dashboard/queries.ts:17-18`). N needs a follow-up count from `getStartOfWeekInTimeZone`, once the household timezone is loaded.
- **Awaiting-approval one-offs stay ACTIVE** (`getAssignedTaskStatus` counts only APPROVED, `assignedTaskState.ts:55-58`), so the existing `status: "ACTIVE"` filters stay.
- **Week-view default member:** `week/page.tsx:64-66` falls back to self; replace it with the resolution order in section 7. `getWeekViewData`'s `userId` becomes a member id or `all`.
- **Preset picker:** the assignments page loads presets via `getVisiblePresetWhere` (`assignments/page.tsx:37`), which includes personal ones. Filter to shared presets in `AssignTaskCard` as well as on the server.
- **Queue copy:** hard-coded strings remain in `AssignedTaskQueue.tsx` (62-65, 71-72, 87-88, 92, 97-101, 156-158, 171). The title "Assignments / Complete tasks that were assigned to you" needs new wording.
- **Migration:** reward tables do not reference `AssignedTask`. Check the generated SQL rebuilds only `AssignedTask` and leaves the `RewardClaimLimit` CHECK constraints untouched (AGENTS.md). `tests/rewardAllowanceUpgrade.test.ts:26-27` builds its old schema from every migration except `20261101…`, so the new migration will apply before it there; run that test.

## 9. Tests

- `tests/assignedTasksRouter.test.ts`: change the existing FORBIDDEN case (`:270`, approver completing the doer's task) to use `outsider`; add `broadcastPush: jest.fn()` to the push mock (`:39`); update the `getWeekViewData` call (`:251-253`). New cases: a non-assignee completes (gets the log), an Open task completes, another member's completion counts toward the task, create/update with null assignee, personal preset rejected on create, un-sharing blocked, deleting a user unassigns.
- `tests/assigned.test.ts`: grouping and the two states.
- `tests/weekViewTimeline.test.ts`: one-off carried forward; calendar-week bounds including week start and DST; old preset keys still parse.
- Pure tests for filter resolution (query, cookie, fallback).
- `pnpm check`, committing the locale files it rewrites.
- Headless browser check of the dashboard and week view with two members.

## 10. PR

One PR: **`feat(board): shared household task board`** (sections 3–7). The original PR 1 shipped as #156. Splitting is still not worth it: the week view's `viewingSelf` gate (`week/page.tsx:125`) ties it to the server change.

Commit order inside it: schema and migration; server and harness tests; dashboard; assignments page; week view.

## 11. Known limitations

- A task's assignee cannot undo someone else's completion of it; the completer or an approver can.
- A sole approver cannot approve their own completion of a preset set to REQUIRE, as today.
- Resolved in Tasks hub PR 6: shared Quick log taps advance matching listed tasks; unmatched taps remain extra work.
- Deleting a preset removes its tasks (with a warning). Existing tasks on personal presets show their labels to everyone (settled).
- Lowering a recurring target below progress, or changing the cadence interval, can leave a period above target; the task reads as met.
- Audit entries do not show which task or assignee a completion belonged to.
- "Last completed" and "Completed last cycle" count pending completions (`assigned.ts:55-63`), now visible household-wide.
- Resolved: switching a recurring task to one-off marks it COMPLETED once a completion is approved (#156); with only pending completions it shows as awaiting approval. Deleting the creating user no longer deletes tasks.

## 12. Later

- Shared outstanding-work helper for dashboard and week view.
- Free-text items, then lists or big cleans, then templates.
- Optional claiming with a short lock.
- Nudges: stale/overdue highlighting, end-of-period reminders.
- Audit annotations; push when a task is assigned; a remove-member flow that unassigns tasks.
