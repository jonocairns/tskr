# PR 1: Read-Only Week View

## Suggested Linear Issue

- Title: `Add read-only week view for current user`
- Parent: `Week view: completed + planned timeline`
- Type/Label: `Feature`
- State: `Todo`

## Goal

Ship a dedicated page at `/[householdId]/week` that shows the current user's recent completed activity plus planned assigned-task occurrences for the default `Past 7 days` range.

This slice should already feel useful on its own and should validate the combined completed/planned timeline concept before adding filters or actions.

## User Value

The user can quickly see what they have done recently and what is coming up, without a deficit-focused or nagging tone.

## Scope

- Add a dedicated week-view route.
- Use server-side household auth and current-user context.
- Default the page to `Past 7 days`.
- Show a points summary for the range.
- Render a single chronological timeline mixing:
  - completed entries from `APPROVED` and `PENDING` logs
  - planned assigned-task occurrences inside the range
- Exclude `REJECTED` completions.
- Add mobile-friendly layout with large readable timeline entries.
- Add positive empty states.

## Out Of Scope

- custom date range controls
- cross-user switching
- inline completion actions
- dashboard integration
- inferred reminders for non-recurring behavior

## Data/Behavior Rules

- The page is read-only in this slice.
- Timeline ordering is chronological.
- Household time zone controls range filtering and display.
- Planned entries should appear only when an expected occurrence lands inside the selected range.
- Recurring tasks should not show `x/y remaining` or missed-occurrence framing.

## Implementation Notes

- Add a week-view data layer under `src/lib/week-view/`.
- Keep the dashboard history logic separate; this page needs range-aware merging, not just existing audit-log output.
- Introduce a timeline entry union for:
  - completed
  - pending approval
  - planned

## Acceptance Criteria

- Visiting `/[householdId]/week` shows a usable page for the current user.
- The default view covers the past 7 days.
- Completed `PENDING` entries appear as done-style history with pending status.
- Rejected entries do not appear.
- Planned assigned-task occurrences inside the range appear in the same timeline.
- The page does not use “missed,” “behind,” or similar guilt-oriented language.
- Mobile layout works as a simple scrollable timeline.
