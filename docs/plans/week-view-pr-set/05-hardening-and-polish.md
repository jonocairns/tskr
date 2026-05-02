# PR 5: Hardening And Polish

## Suggested Linear Issue

- Title: `Harden week-view edge cases and polish the experience`
- Parent: `Week view: completed + planned timeline`
- Type/Label: `Improvement`
- State: `Todo`

## Goal

Lock down the edge cases and UI details that turn the week view from a functional feature into a reliable production surface.

## User Value

The page behaves consistently across approvals, one-off tasks, date boundaries, and mobile usage without surprising duplicate or missing entries.

## Scope

- Add tests for occurrence generation and timeline merge/dedupe behavior.
- Add tests for date-boundary behavior in household time zones.
- Tighten empty states and status styling.
- Improve loading/refresh behavior where needed.
- Reconcile any rough edges discovered in earlier slices.

## Edge Cases To Cover

- non-recurring assigned tasks with pending approval
- one-off tasks that should stop producing planned entries after being treated as done
- cadence windows that overlap selected-range boundaries
- duplicate suppression between planned entries and matching `PENDING`/`APPROVED` completions
- selected-user behavior versus acting-user permission gates

## Out Of Scope

- new product scope beyond the agreed week-view behavior
- inferred reminders for historically repeated non-recurring tasks

## Acceptance Criteria

- Automated tests cover the key range and dedupe rules.
- The page does not emit duplicate planned/completed entries for one occurrence.
- Pending approval state is visually clear and consistent.
- Empty states remain positive and on-message.
- Mobile interactions remain straightforward with large tap targets.
