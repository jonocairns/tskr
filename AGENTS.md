# CLAUDE.md

**tskr** - Household task management with assignments, completion logging, and points-based rewards.

## Commands

**Dev**: `pnpm dev` | `pnpm build` | `pnpm start`
**DB**: `pnpm db:migrate` (dev) | `pnpm db:sync` (prod) | `pnpm db:bootstrap`
**Quality**: `pnpm lint` | `pnpm compile` (uses tsgo) | `pnpm test [filename]` | `pnpm check` (all)

## Stack

Next.js 16 + React 19 | Prisma + SQLite | tRPC + TanStack Query | NextAuth.js | Tailwind + Radix UI | Biome

## Core Concepts

**Households**: Multi-tenant. Users join households. `lastHouseholdId` tracks active context.

**Roles** (per household): DICTATOR (admin) | APPROVER (approve tasks) | DOER (complete tasks)

**Points**: TINY=1, QUICK=3, ROUTINE=6, CHALLENGING=10, HEAVY=15, MAJOR=21

**Preset Tasks**: Reusable templates (personal or shared)

**Assigned Tasks**: User-assigned with optional cadences (daily/weekly/etc). Tracks completion vs target.

**Approval Flow**: Completions can require approval. Status: PENDING/APPROVED/REJECTED

## Key Patterns

**tRPC**:
- Procedures: `publicProcedure` | `protectedProcedure` | `householdProcedure` | `approverProcedure` | `dictatorProcedure` | `superAdminProcedure`
- See [docs/TRPC.md](docs/TRPC.md)

**Household Routing** (URL-based, NOT session-based):
- Route: `/[householdId]/*`
- Server pages: Use `getHouseholdContext(householdId)` for auth + membership
- **tRPC procedures**: Use `protectedProcedure` + manually validate with:
  - `validateHouseholdMembershipFromInput(userId, input)` - membership check
  - `validateApproverRoleFromInput(userId, input)` - APPROVER/DICTATOR check
  - `validateDictatorRoleFromInput(userId, input)` - DICTATOR check
  - All inputs must include `householdId: z.string().min(1)`
- **Client**: Get `householdId` from `useParams()`, pass to all tRPC calls
- **Session**: Only stores `id`, `isSuperAdmin`, `hasGoogleAccount` (NOT household context)

**Real-time**: SSE at `/api/stream`, pub/sub via `src/lib/eventsCore.ts`, `publishDashboardUpdate()`

**Database**: Prisma singleton in `src/lib/prisma.ts`, cascade deletes configured

**Error Handling**: Production error sanitization in `src/lib/errorSanitization.ts`

**Path Aliases**: `@/*` → `src/*` | `@/config` → `config.ts` | `@/server-config` → `server-config.ts`

## Auth

**Providers**: Credentials (bcrypt) + Google OAuth (optional)

**Super Admin**: Set `SUPER_ADMIN_EMAIL`, temp password logged. Use `SUPER_ADMIN_FORCE_PASSWORD=1` to rotate.

**Rate Limiting**: Login attempts, join household requests

## Env Vars

**Required**: `NEXTAUTH_SECRET`, `NEXTAUTH_URL`

**Optional**: `DATABASE_URL`, `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, `SUPER_ADMIN_EMAIL`, `SUPER_ADMIN_PASSWORD`, `SUPER_ADMIN_FORCE_PASSWORD`, `VAPID_*`

## Notes

- Use `tsgo` for type checking (not `tsc`)
- Biome for linting (not ESLint/Prettier)
- Files with `"server-only"` cannot be client-imported
- NO useless comments
