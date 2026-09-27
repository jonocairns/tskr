Capture new durable conventions, invariants, and recurring pitfalls here when they will help future agents make better decisions.

- Use implicit return types instead of explicit annotations
- Prefer `const` arrow functions over `function` declarations
- After making changes, run `pnpm check` (i18n + lint + compile + build + test)
- If Jest warns about a haste naming collision with `.next/standalone/package.json`, it is caused by an existing build artifact; the tests still run, but the warning can be removed by cleaning `.next/standalone`
- Keep `HOSTNAME=0.0.0.0` in the Docker image: Next.js standalone uses Docker's container hostname otherwise, leaving the loopback health check unreachable. Startup smoke tests should exercise the image's default bind address.
- Releases are managed by Release Please in `.github/workflows/ci.yml`. Use Conventional Commit titles; `feat`, `fix`, and `perf` trigger releases. Do not manually bump versions, create tags, or publish images. Tags retain the `x.y.z` format without a `v` prefix. Only a successful CI run for the merged release PR can publish its image; rerun that workflow to recover a failed publication.
- `cancel-in-progress: false` still replaces pending runs in a shared concurrency group unless `queue: max` is set. Keep main CI grouped by commit and release/publication jobs queued and serialized so release commits are processed and the `latest` check/write cannot race.
