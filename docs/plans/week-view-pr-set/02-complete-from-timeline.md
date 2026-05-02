# PR 2: Complete From Timeline

## Suggested Linear Issue

- Title: `Allow assigned tasks to be completed from the week view`
- Parent: `Week view: completed + planned timeline`
- Type/Label: `Feature`
- State: `Todo`

## Goal

Let the acting user complete eligible planned assigned-task entries directly from the week-view timeline.

## User Value

The week view becomes a lightweight management surface rather than just a report, while still preserving the same approval rules and task-completion behavior the app already uses elsewhere.

## Scope

- Add a clear `Complete` action to eligible planned entries.
- Reuse existing assigned-task completion mutation and toast behavior.
- Immediately refresh the page after completion.
- If approval is required, show the new completion as `Pending approval`.
- Remove or suppress the corresponding planned entry after the completion is created.

## Out Of Scope

- cross-user viewing
- custom range selection
- bulk completion
- alternate completion flows for timed/manual tasks

## Data/Behavior Rules

- Completion is only available when the acting user is viewing their own timeline.
- Tasks requiring approval should be treated as done in this page immediately after submission.
- A single occurrence should never appear as both completed and still pending after the completion action.

## Implementation Notes

- Reuse `assignedTasks.complete`.
- Preserve the current rule that only the assigned user can complete the assigned task.
- The planned-occurrence builder or merger must suppress duplicate planned items after `PENDING` or `APPROVED` completion exists.

## Acceptance Criteria

- Planned entries for the acting user show a prominent `Complete` button.
- Completing an entry creates the same kind of record as existing assigned-task completion.
- If approval is required, the timeline shows the completion as pending approval rather than still pending work.
- Duplicate “still to do” entries are not left behind for the same occurrence.
- The page still reads as positive activity, not a compliance queue.
