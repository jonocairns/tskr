# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

**tskr** is a household task management system that makes chores fair and visible through task assignments, completion logging, and a points-based reward system. Built for families, roommates, and shared houses.

## Development Commands

### Package Management
- This project uses **pnpm** (`pnpm@10.26.1`)
- Install dependencies: `pnpm install`

### Development
- `pnpm dev` - Start Next.js dev server
- `pnpm build` - Build for production
- `pnpm start` - Start production server

### Database
- `pnpm db:generate` - Generate Prisma client
- `pnpm db:migrate` - Run migrations in dev (creates migration files)
- `pnpm db:sync` - Deploy migrations (production)
- `pnpm db:reset` - Reset database (dev only)
- `pnpm db:bootstrap` - Bootstrap super admin and defaults
- `pnpm db:setup` - Deploy migrations + bootstrap (used in Docker)

### Code Quality
- `pnpm lint` - Run Biome linter
- `pnpm lint:fix` - Auto-fix linting issues
- `pnpm compile` - Type check with TypeScript (uses `tsgo --pretty`)
- `pnpm test` - Run Jest tests
- `pnpm check` - Run all checks (lint + compile + test)

### Testing
- Run all tests: `pnpm test`
- Run single test file: `pnpm test <filename>` (e.g., `pnpm test pointsSummary`)
- Tests are located in `tests/` directory
- Jest config: [jest.config.cjs](jest.config.cjs)

## Architecture

### Tech Stack
- **Framework**: Next.js 16 (App Router) + React 19
- **Database**: Prisma ORM + SQLite (default, adapter-based for flexibility)
- **API Layer**: tRPC for type-safe API calls
- **Auth**: NextAuth.js with credentials + optional Google OAuth
- **Styling**: Tailwind CSS + Radix UI components
- **State Management**: TanStack Query (React Query) via tRPC
- **Linting**: Biome (replaces ESLint/Prettier)

### Core Concepts

**Households**: Multi-tenant system where users can create and join households. Each user has a `lastHouseholdId` representing their active household context.

**Roles**: Three-tier role system per household (DICTATOR, APPROVER, DOER):
- DICTATOR: Full admin control
- APPROVER: Can approve/reject task completions
- DOER: Can log task completions

**Points System**: Tasks are categorized into duration buckets (TINY=1pt, QUICK=3pts, ROUTINE=6pts, CHALLENGING=10pts, HEAVY=15pts, MAJOR=21pts). Points accumulate toward household rewards.

**Preset Tasks**: Reusable task templates that households create. Can be personal or shared across the household.

**Assigned Tasks**: Tasks assigned to specific users with optional recurring cadences (daily, weekly, etc.). Tracks completion count vs target within cadence intervals.

**Approval Flow**: Task completions can require approval based on user settings and task overrides. Logs have PENDING/APPROVED/REJECTED status.

### Directory Structure

```
src/
├── app/                    # Next.js App Router pages
│   ├── api/               # API routes (NextAuth, tRPC, SSE stream)
│   ├── admin/             # Super admin dashboard
│   ├── assignments/       # Task assignment management
│   ├── household/         # Household settings
│   └── page.tsx           # Main dashboard
├── components/            # React components
│   └── ui/               # Radix UI wrapper components
├── lib/                   # Core business logic
│   ├── dashboard/        # Dashboard data aggregation
│   ├── trpc/             # tRPC client setup
│   ├── auth.ts           # NextAuth configuration
│   ├── prisma.ts         # Prisma client singleton
│   ├── points.ts         # Points/bucket definitions
│   ├── assignedTasksCadence.ts  # Cadence logic
│   ├── events.ts         # Real-time event pub/sub
│   └── households.ts     # Household membership helpers
├── server/
│   ├── routers/          # tRPC route definitions
│   │   ├── _app.ts       # Router composition
│   │   └── households/   # Nested household routers
│   └── trpc.ts           # tRPC context & procedure builders
├── types/                # TypeScript type definitions
config.ts                 # Shared client/server config
server-config.ts          # Server-only config
prisma/schema.prisma      # Database schema
tests/                    # Jest unit tests
```

### Key Patterns

**tRPC Architecture**:
- Server procedures defined in `src/server/routers/`
- Client setup in `src/lib/trpc/client.ts` and `src/lib/trpc/react.tsx`
- Type-safe end-to-end with `AppRouter` type export
- Procedures use middleware for auth/roles: `protectedProcedure`, `householdProcedure`, `dictatorProcedure`, `approverProcedure`, `superAdminProcedure`

**Real-time Updates**:
- Server-Sent Events (SSE) endpoint at `/api/stream`
- In-process pub/sub via `src/lib/eventsCore.ts` using global handlers
- Dashboard components subscribe to `publishDashboardUpdate()` events
- Client reconnects automatically on disconnect

**Session Management**:
- NextAuth sessions contain user identity and auth status only (`id`, `isSuperAdmin`, `hasGoogleAccount`)
- Session validation includes idle timeout (24hr) and max age (30 days)
- Session tokens validated via `validateSessionExpiry()` in tRPC middleware
- **Household context is NOT stored in session** - see Household Routing below

**Household Routing**:
- URL-based routing pattern: `/[householdId]/*` for all household-scoped pages
- Layout at `app/[householdId]/layout.tsx` validates membership before rendering
- Server pages use `getHouseholdContext(householdId)` helper for auth + membership validation
- Invalid household access redirects to active household with error toast
- **Mixed pattern (stable architecture)**:
  - **Page routes**: Use URL-based household context (explicit `householdId` param)
  - **tRPC procedures**: Use session-based active household (`getActiveHouseholdMembership()`)
    - This works because tRPC calls are made from pages that already have validated household access
    - The user's "active household" matches the URL householdId when they switch households
    - Avoids requiring householdId in every tRPC call signature
  - **New procedures needing explicit household**: Use `householdFromInputProcedure` for procedures that accept `householdId` in input
  - **SSE stream**: Accepts optional `householdId` query param, falls back to active household
- Client components can access `householdId` from URL params via `useParams()`
- **Future consolidation**: To fully move to URL-based pattern, all tRPC procedures would need householdId input (breaking API change)

**Database Patterns**:
- Prisma singleton in `src/lib/prisma.ts` with better-sqlite3 adapter
- All Prisma queries should use the singleton from `@/lib/prisma`
- Cascade deletes configured in schema for household/user relationships
- Indexes on foreign keys and frequently queried fields

**Error Handling**:
- tRPC errors use standard codes (UNAUTHORIZED, FORBIDDEN, etc.)
- Production error sanitization via `src/lib/errorSanitization.ts`
- Dev mode warnings for potential information leakage in error messages

**Path Aliases**:
- `@/*` maps to `src/*`
- `@/config` maps to `config.ts` (client-safe config)
- `@/server-config` maps to `server-config.ts` (server-only config)

DO NOT add useless comments, only when the code itself doesn't explain itself (which should be very rare)

### Authentication

**Providers**:
- Credentials (email + password with bcrypt)
- Google OAuth (optional, enabled via env vars)

**Super Admin Bootstrap**:
- Set `SUPER_ADMIN_EMAIL` in env to bootstrap first super admin
- Temporary password logged on first bootstrap
- Force password reset on first login via `passwordResetRequired` flag
- Set `SUPER_ADMIN_FORCE_PASSWORD=1` to rotate password on next bootstrap

**Rate Limiting**:
- Login attempts rate limited per email address
- Join household rate limited per user

## Environment Variables

Required:
- `NEXTAUTH_SECRET` - Session encryption secret
- `NEXTAUTH_URL` - App URL (e.g., `http://localhost:3000`)

Optional:
- `DATABASE_URL` - Defaults to `file:./prisma/dev.db`
- `GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET` - Enable Google OAuth
- `SUPER_ADMIN_EMAIL` - Bootstrap super admin account
- `SUPER_ADMIN_PASSWORD` - Override generated password
- `SUPER_ADMIN_FORCE_PASSWORD=1` - Rotate super admin password on next bootstrap
- `VAPID_PUBLIC_KEY` / `VAPID_PRIVATE_KEY` / `VAPID_SUBJECT` - Push notifications

## Important Notes

**Type Checking**: This project uses `tsgo` (TypeScript Native Preview) instead of `tsc` for type checking. Use `pnpm compile` rather than `tsc` directly.

**Linting**: Biome is used for linting and formatting, not ESLint/Prettier. Configuration in `biome.json`.

**Server-Only Code**: Files importing `"server-only"` cannot be imported by client components. This includes tRPC routers and core server logic.

**Points Midnight Reset**: Assigned task completions reset at midnight based on cadence intervals. Logic in `src/lib/assignedTasksCadence.ts`.

**Dashboard Data**: Dashboard aggregates data from multiple sources (audit log, leaderboard, approvals, assigned tasks). See `src/lib/dashboard/queries.ts` for the main query builder.
