Capture new durable conventions, invariants, and recurring pitfalls here when they will help future agents make better decisions.

- Use implicit return types instead of explicit annotations
- Prefer `const` arrow functions over `function` declarations
- After making changes, run `pnpm check` (i18n + lint + compile + build + test)
- If Jest warns about a haste naming collision with `.next/standalone/package.json`, it is caused by an existing build artifact; the tests still run, but the warning can be removed by cleaning `.next/standalone`
