# Week View PR Set

## Suggested Linear Parent

- Title: `Week view: completed + planned timeline`
- Team: `tskr`
- Type/Label: `Feature`
- State: `Todo`

## Summary

Build a dedicated household-scoped week view that lets a user see what a person has done and what is coming up, without turning the experience into a guilt-oriented dashboard.

Route target:

- `/[householdId]/week`

Default behavior:

- selected user defaults to the acting user
- date range defaults to `Past 7 days`
- timeline is chronological in household time zone

Core product outcome:

- “I can see both what I’ve done and what’s coming up without feeling nagged.”

## Confirmed Product Decisions

- This is a dedicated page in v1, not a dashboard section.
- The page should emphasize completed items first.
- It should also show planned assigned-task occurrences inside the selected range.
- `APPROVED` and `PENDING` completions both count as done in this view.
- `REJECTED` completions should not appear.
- Recurring tasks should show actual completions but should not surface “missing repeats” as deficits.
- Anyone in the same household can switch between users in the view.
- Only the acting user can complete their own tasks in v1.
- Mobile should be a simple scrollable timeline with large tap targets.
- Empty state should positively emphasize upcoming/planned work; if there is none, show no activity.

## Delivery Strategy

Split the work into horizontal slices so each PR produces a usable end-to-end increment across route, data, and UI.

Order:

1. Read-only week view for current user with fixed past-7-days range.
2. Complete assigned tasks directly from the week view.
3. Replace fixed range with custom date range.
4. Add cross-user switching.
5. Harden edge cases and polish.

## Important Implementation Notes

- Reuse household URL auth and server-page patterns already used by the app.
- Reuse existing assigned-task completion mutation rather than introducing a parallel completion path.
- Introduce a week-view domain layer instead of bolting this onto dashboard query code.
- Planned timeline entries need range-aware occurrence generation, not just the current “active now” assigned-task state.
- Planned entries must be deduped against matching `PENDING` or `APPROVED` completions so the same occurrence does not show as both done and still pending.
- Keep translation keys owned by the page/UI layer rather than burying them inside the domain builder.
- Preserve strong invariants around timeline entry status values rather than relying only on upstream query filters.

## Follow-Up Notes From PR 1

- The initial recurring-occurrence builder is acceptable for the fixed `Past 7 days` slice, but it should be replaced before broader custom ranges ship.
- For custom ranges, occurrence stepping should advance deterministically by cadence period rather than relying on a defensive loop cap or minute-by-minute fallback.
- Small cleanup items such as translation-key typing and status invariant hardening can be folded into later slices instead of reopening PR 1.

## Known Open Detail

For non-recurring one-off assigned tasks, the v1 assumption is:

- they emit a planned occurrence on `assignedAt`

If product wants old still-open one-offs to keep appearing across later selected ranges, that should be treated as a separate rule change.
