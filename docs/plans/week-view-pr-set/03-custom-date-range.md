# PR 3: Custom Date Range

## Suggested Linear Issue

- Title: `Add custom date range controls to the week view`
- Parent: `Week view: completed + planned timeline`
- Type/Label: `Feature`
- State: `Todo`

## Goal

Replace the fixed `Past 7 days` view with URL-driven custom date range controls while keeping `Past 7 days` as the default initial state.

## User Value

The user can look back across different periods without losing the positive completed-plus-planned shape of the page.

## Scope

- Add `from` and `to` URL-backed date controls.
- Keep `Past 7 days` as the default when parameters are absent.
- Recompute completed entries, planned occurrences, and points summary based on the selected range.
- Ensure the page remains shareable/bookmarkable by URL.

## Out Of Scope

- cross-user viewing
- dashboard integration
- non-cadence reminder heuristics

## Data/Behavior Rules

- Range logic is based on the household time zone.
- Completed entries are filtered by created date inside the selected range.
- Planned entries appear only when an expected occurrence falls inside the selected range.
- Recurring tasks still should not surface missing expected repeats as deficits.

## Implementation Notes

- Parse and validate date params on the server page.
- Normalize the selected local dates to household-time-zone boundaries before querying/building timeline data.
- Keep page architecture server-first; the control can still submit/replace URL params.

## Acceptance Criteria

- The page defaults to past 7 days when opened without query params.
- Selecting a custom range updates timeline entries and points summary correctly.
- The selected range is reflected in the URL.
- Timeline ordering remains chronological.
- Date-boundary behavior is stable in the household time zone.
