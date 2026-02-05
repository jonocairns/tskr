# CLAUDE.md

**tskr** - Household task management with assignments, completion logging, and points-based rewards.

## Commands

**Dev**: `pnpm dev` | `pnpm build` | `pnpm start`
**DB**: `pnpm db:migrate` (dev) | `pnpm db:sync` (prod) | `pnpm db:bootstrap`
**Quality**: `pnpm lint` | `pnpm compile` | `pnpm test [filename]` | `pnpm check` (all)

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
- **tRPC procedures**: Use `householdProcedure`, `approverProcedure`, or `dictatorProcedure` (validates membership via middleware)
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

- Biome for linting (not ESLint/Prettier)
- Files with `"server-only"` cannot be client-imported
- NO useless comments

## Code Style Preferences

### Function Declarations

**Prefer `const` arrow functions over `function` declarations:**

```typescript
// ✅ Preferred
const handleClick = async () => {
  // implementation
};

const calculateTotal = (items: Item[]) => {
  // implementation
};

// ❌ Avoid
async function handleClick() {
  // implementation
}

function calculateTotal(items: Item[]) {
  // implementation
}
```

**Rationale:**
- Ensures functions cannot be reassigned
- More consistent with modern React patterns (especially hooks)
- Hoisting behavior is more predictable
- Popular convention in the React community

### JSX Conditional Rendering

**Prefer explicit ternaries with `null` over `&&` operator:**

```typescript
// ✅ Preferred
{condition ? <Component /> : null}
{enabled ? <div>Content</div> : null}

// ❌ Avoid
{condition && <Component />}
{enabled && <div>Content</div>}
```

**Rationale:**
- Makes the intent explicit that nothing should render when false
- Avoids potential bugs with falsy values (0, "", etc.) being rendered
- More consistent and predictable behavior

### Return Types

**Use implicit return types instead of explicit annotations:**

```typescript
// ✅ Preferred
const calculateTotal = (items: Item[]) => {
  return items.reduce((sum, item) => sum + item.price, 0);
};

const fetchUser = async (id: string) => {
  const user = await db.user.findUnique({ where: { id } });
  return user;
};

// ❌ Avoid
const calculateTotal = (items: Item[]): number => {
  return items.reduce((sum, item) => sum + item.price, 0);
};

const fetchUser = async (id: string): Promise<User | null> => {
  const user = await db.user.findUnique({ where: { id } });
  return user;
};
```

**Rationale:**
- TypeScript infers return types accurately
- Reduces visual noise and boilerplate
- Keeps code cleaner and more maintainable
- Explicit return types are only needed for public APIs or when inference fails

## Review guidelines
- Comment only on issues likely to break production or materially harm users/data.
- Focus on auth/roles, household isolation, data integrity, migrations, points/rewards, hot‑path performance.
- Skip: *.lock, *.snap, *.generated.*, vendor/, node_modules/, *.min.*, dist/, build/.

