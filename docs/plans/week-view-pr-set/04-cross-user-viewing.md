# PR 4: Cross-User Viewing

## Suggested Linear Issue

- Title: `Add household member switching to the week view`
- Parent: `Week view: completed + planned timeline`
- Type/Label: `Feature`
- State: `Todo`

## Goal

Allow any household member to switch between users on the week-view page while keeping completion actions restricted to the acting user.

## User Value

People can check another household member’s recent activity and upcoming tasks without needing a separate admin-only audit flow.

## Scope

- Add a user selector for household members.
- Allow the selected member to be controlled by URL/query state.
- Load completed and planned timeline data for the selected member.
- Gate completion controls so only the acting user can complete their own tasks.
- Adjust page copy where needed so it reads well for “me” and “another person.”

## Out Of Scope

- completing tasks on behalf of another user
- role-gated viewing restrictions
- household-wide aggregate week view

## Data/Behavior Rules

- Any household member can switch between users in the same household.
- Only the acting user can complete assigned tasks in v1.
- The selected user’s `APPROVED` and `PENDING` completions count as done in the view.

## Implementation Notes

- Reuse household membership data already available in server-side household context.
- Keep permissions simple: view-any-member, complete-self-only.

## Acceptance Criteria

- Users can switch between members in the same household.
- The timeline and points summary update to reflect the selected member.
- Completion actions are shown only when the selected user matches the acting user.
- The page remains understandable and non-nagging when viewing another member.
