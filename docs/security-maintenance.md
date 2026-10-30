# Dependency and container security

Last checked: 2026-10-31.

The npm registry audit initially reported 23 advisories: 4 critical, 6 high,
9 moderate, and 4 low. Updates to Next.js 16.4.3, Prisma 7.10.1, Zod 4.6.7,
ts-jest 29.4.15, and their transitive dependencies remove every fixable finding.
React and React DOM are aligned at 19.3.1. The resulting production dependency
audit reports no known vulnerabilities.

The build tool itself also needs maintenance: pnpm 10.26.1 is affected by
multiple installation-time path traversal and configuration advisories that
`pnpm audit` does not include. The project now uses pnpm 10.34.9, outside the
affected ranges returned by the npm advisory API.

## Remaining package advisory

`i18next-scanner` depends on `deepmerge` 4.3.1, affected by
[GHSA-gcqx-w48m-w2h4 / CVE-2026-93753](https://github.com/advisories/GHSA-gcqx-w48m-w2h4).
The registry rates this as low severity and lists no patched version. This is
development tooling used to merge repository translation resources; it is not
installed in the production dependency tree. Keep the advisory visible and
update or replace the scanner when a supported fix becomes available. Do not
process untrusted translation inputs with it.

## Docker image

The base moves from Node 24.12.0 on Debian 12 to Node 24.22.2 on Debian 13
(`trixie-slim`), pinned to the multi-architecture manifest digest. CI uses the
same Node version. Debian packages are upgraded during the base stage, and CI
and publication builds bypass that stage's cache to refresh security updates.
Dependabot already checks npm dependencies, Docker references, and GitHub
Actions weekly.

Trivy 0.76.1 registry scans of the old and new **base images** found:

- Old base OS: 6 critical and 68 high package/advisory matches, including
  17 with a vendor fix. Bundled JavaScript tooling adds 1 critical and 29 high.
- New base OS: no critical findings, 43 high matches across 8 unique
  advisories, and no available vendor fixes at scan time. Its bundled npm
  dependencies still have 6 fixable high findings.

The runner removes npm, Corepack, and Yarn because migrations and startup call
Node directly. All 17 JavaScript findings in the new base scan were under the
removed npm directory. Build stages retain their package managers.

The unresolved high OS findings concern util-linux, acl, systemd, ncurses, and
Perl. Counts include a single source-package advisory repeated across several
binary packages; they do not establish that the application exposes the
affected feature. They remain in the full CI report for review rather than
being placed on an ignore list.

Local registry scans cover the base, not the complete application image.
Docker Desktop's engine was unavailable in this workspace, so the updated
image build, database migration/bootstrap, default bind address, and health
check still need CI verification. CI runs the existing startup smoke check,
uploads `container-vulnerabilities.json` with all severities and unfixed
findings, and fails on fixable high/critical image vulnerabilities. It also
runs `pnpm audit --audit-level=moderate` over production and development
dependencies, leaving the unfixed low finding visible.

## Rechecking

Run these after an update:

```bash
pnpm install --frozen-lockfile
pnpm prisma generate
pnpm check
pnpm audit --prod
pnpm audit --audit-level=moderate
docker buildx build --load --no-cache-filter base -t tskr-security:local .
bash scripts/ci/docker-smoke.sh tskr-security:local
trivy image --scanners vuln tskr-security:local
trivy image --scanners vuln --ignore-unfixed --severity HIGH,CRITICAL --exit-code 1 tskr-security:local
```

Advisory databases change over time; a successful audit is a dated observation,
not a guarantee of no vulnerabilities. After the normal release workflow
publishes these changes, pull the release and recreate the deployed container
with its existing `/data` volume. Updating this repository does not patch an
already running container.
