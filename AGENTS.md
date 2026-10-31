Capture new durable conventions, invariants, and recurring pitfalls here when they will help future agents make better decisions.

- Use implicit return types instead of explicit annotations
- Prefer `const` arrow functions over `function` declarations
- Assignment capacity counts non-reverted `PENDING` and `APPROVED` logs. Complete, resubmit, and recurrence/status edits must validate and write in one transaction; SQLite's deferred transactions need a write lock before reading capacity. Resubmission retains the original `createdAt` cadence window.
- Assignment cadence uses household calendar boundaries, not time since completion. Display ranges must not truncate the completion history used for eligibility; "Completed last cycle" means the immediately preceding calendar cycle met its target.
- After making changes, run `pnpm check` (i18n + lint + compile + build + test)
- If Jest warns about a haste naming collision with `.next/standalone/package.json`, it is caused by an existing build artifact; the tests still run, but the warning can be removed by cleaning `.next/standalone`
- Keep `HOSTNAME=0.0.0.0` in the Docker image: Next.js standalone uses Docker's container hostname otherwise, leaving the loopback health check unreachable. Startup smoke tests should exercise the image's default bind address.
- Docker liveness uses `/api/health`, which bypasses the proxy and has no auth or database dependencies. Keep the Dockerfile healthcheck and startup smoke probe aligned with this route.
- Keep CI's Node version aligned with the pinned Docker base. Startup uses Node/Prisma directly; package managers are intentionally absent from the final image.
- On WSL, `docker.exe` can reach Docker Desktop without WSL integration. A `git archive HEAD` build context includes only committed changes.
- Keep dependency audits and image scans informational, including scanner/reporting failures. Ordinary PR Docker builds use the cache; release builds refresh the base and report both architectures of the exact published digest, including on retries. Assess actual exposure from full reports rather than blocking on advisory presence; see README's security checks.
- Releases are managed by Release Please in `.github/workflows/ci.yml`. Use Conventional Commit titles; `feat`, `fix`, and `perf` trigger releases. Do not manually bump versions, create tags, or publish images. Tags retain the `x.y.z` format without a `v` prefix. Only a successful CI run for the merged release PR can publish its image; rerun that workflow to recover a failed publication.
- `cancel-in-progress: false` still replaces pending runs in a shared concurrency group unless `queue: max` is set. Keep main CI grouped by commit and release/publication jobs queued and serialized so release commits are processed and the `latest` check/write cannot race.
