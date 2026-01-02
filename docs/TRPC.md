# tRPC Implementation Guide

This project uses [tRPC](https://trpc.io/) with [TanStack Query](https://tanstack.com/query) for type-safe API calls between client and server.

## Architecture Overview

```
┌─────────────────┐
│  Client (React) │
│  + TanStack     │
│    Query        │
└────────┬────────┘
         │ HTTP (batched)
         │ + SuperJSON
         ▼
┌─────────────────┐
│  tRPC Router    │
│  + Middleware   │
│  + Validation   │
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│  Database       │
│  (Prisma)       │
└─────────────────┘
```

## Key Files

- **`src/lib/trpc/client.ts`** - Server-side tRPC client (vanilla)
- **`src/lib/trpc/react.tsx`** - Client-side React hooks + provider
- **`src/server/trpc.ts`** - tRPC instance + middleware configuration
- **`src/server/routers/_app.ts`** - Main router combining all sub-routers
- **`src/app/api/trpc/[trpc]/route.ts`** - Next.js API route handler

## Client Usage

### In React Components

```tsx
import { trpc } from "@/lib/trpc/react";

export function MyComponent() {
  // Query (GET)
  const { data, isLoading } = trpc.households.getCurrent.useQuery();

  // Mutation (POST/PUT/DELETE)
  const updateMutation = trpc.households.updateCurrent.useMutation({
    onSuccess: () => {
      // Refetch after successful update
      utils.households.getCurrent.invalidate();
    },
  });

  return <div>{data?.household.name}</div>;
}
```

### Cache Invalidation

```tsx
const utils = trpc.useUtils();

// Invalidate specific query
utils.households.getCurrent.invalidate();

// Invalidate all household queries
utils.households.invalidate();

// Invalidate everything
utils.invalidate();
```

### Server-Side Client (Avoid if possible!)

**⚠️ Important:** In Server Components, use Prisma directly instead of the tRPC client. The tRPC client makes HTTP requests which is slower than direct database access.

**Use tRPC client only when:**
1. Calling from API routes or server actions
2. You need to enforce the same authorization logic as tRPC procedures
3. Calling from a separate service

```ts
// ❌ DON'T: Inefficient in Server Components
import { trpcClient } from "@/lib/trpc/client";
const result = await trpcClient.households.getCurrent.query();

// ✅ DO: Direct Prisma access in Server Components
import { prisma } from "@/lib/prisma";
const household = await prisma.household.findUnique({ where: { id } });
```

## Cache Configuration

### Default Settings

```ts
{
  staleTime: 30_000,           // 30 seconds
  refetchOnWindowFocus: false,
  retry: 3,
  retryDelay: 1000,
}
```

### Stale Time Recommendations

| Data Type | Stale Time | Example |
|-----------|------------|---------|
| Static/rarely changing | 5-10 minutes or `Infinity` | App settings, presets |
| User data | 30-60 seconds | Profile, household info |
| Real-time data | 0-5 seconds | Logs, assigned tasks |
| List data | 30 seconds | Member lists, invite lists |

### Override Per-Query

```tsx
const { data } = trpc.households.getCurrent.useQuery(undefined, {
  staleTime: 60 * 1000, // 1 minute
  refetchOnWindowFocus: true,
});
```

## SuperJSON Serialization

SuperJSON automatically handles types that JSON doesn't support:

### Supported Types

- **Date objects** - No more `.toISOString()` needed!
- **undefined** - Unlike JSON.stringify
- **BigInt** - For large numbers
- **Map & Set** - If you need them
- **RegExp** - Regular expressions

### Example

```ts
// Server
export const myRouter = router({
  getUser: publicProcedure.query(async () => {
    return {
      createdAt: new Date(),        // ✅ Date object
      lastLogin: undefined,          // ✅ undefined preserved
      metadata: new Map([['key', 'val']]), // ✅ Map preserved
    };
  }),
});

// Client
const { data } = trpc.getUser.useQuery();
data.createdAt.getFullYear(); // ✅ Still a Date object!
```

## Middleware & Authorization

### Available Procedures

```ts
// No auth required
publicProcedure

// User must be authenticated
protectedProcedure

// User must have a household
householdProcedure

// User must be APPROVER or DICTATOR
approverProcedure

// User must be DICTATOR
dictatorProcedure

// User must be super admin
superAdminProcedure
```

**Note:** `householdProcedure`, `approverProcedure`, and `dictatorProcedure` require an input schema that includes
`householdId: z.string()`.

### Example Usage

```ts
export const myRouter = router({
  // Anyone can call this
  public: publicProcedure.query(() => ({ message: "Hello" })),

  // Must be authenticated
  private: protectedProcedure.query(({ ctx }) => {
    const userId = ctx.session.user.id; // ✅ Typed and guaranteed
    return { userId };
  }),

  // Must have household
  household: householdProcedure(z.object({ householdId: z.string().min(1) })).query(({ ctx }) => {
    const householdId = ctx.household.id; // ✅ Typed and guaranteed
    return { householdId };
  }),
});
```

### Session Validation

Sessions are validated for:
1. **Absolute expiry**: 30 days since creation
2. **Idle timeout**: 24 hours since last activity

Both are configurable in `config.ts`:
```ts
sessionMaxAge: 30 * 24 * 60 * 60,      // 30 days
sessionIdleTimeout: 24 * 60 * 60,      // 24 hours
```

## Input Validation

All inputs are validated with [Zod](https://zod.dev/):

```ts
const updateSchema = z.object({
  name: z.string().trim().min(2).max(50),
  email: z.email(),
  age: z.number().int().min(18),
});

export const myRouter = router({
  update: protectedProcedure
    .input(updateSchema)
    .mutation(({ input }) => {
      // input is fully typed and validated
      const { name, email, age } = input;
    }),
});
```

## Error Handling

### Error Sanitization

In production, error messages are sanitized to prevent information leakage:

```ts
// Development
throw new TRPCError({
  code: "NOT_FOUND",
  message: "Household with ID abc123 not found"
});
// ✅ Shows full message in dev

// Production
// ✅ Shows generic: "Resource not found"
```

### Error Boundary

The app includes a global error boundary that automatically:
1. Catches unhandled tRPC errors
2. Displays user-friendly error UI
3. Invalidates queries on retry (refetches fresh data)

```tsx
// Automatically included in Providers
<TRPCErrorBoundaryWithQueryInvalidation>
  {children}
</TRPCErrorBoundaryWithQueryInvalidation>
```

### Dev Mode Security Warnings

In development, the system warns about potentially sensitive error messages:

```ts
// This will trigger a warning in dev:
throw new TRPCError({
  code: "INTERNAL_SERVER_ERROR",
  message: `User email is ${user.email}` // ⚠️ Leaks email!
});
```

## Security Features

### CSRF Protection

The tRPC endpoint validates the `Origin` and `Referer` headers for all mutations to prevent CSRF attacks.

### Request Size Limits

Requests larger than 1MB are rejected to prevent DoS attacks:

```ts
maxRequestBodySize: 1024 * 1024 // 1MB (configurable in config.ts)
```

### Rate Limiting

Join household requests are rate limited:
- **Window**: 60 seconds (configurable)
- **Max attempts**: 5 (configurable)
- **Cleanup**: Automatic every 5 minutes

**⚠️ Production Note:** The current in-memory rate limiting won't work across multiple server instances. Use Redis for production:

```ts
// TODO: Replace with Redis for production
import { Redis } from '@upstash/redis';
```

## Creating New Routers

### 1. Create Router File

```ts
// src/server/routers/myFeature.ts
import "server-only";
import { router, protectedProcedure } from "@/server/trpc";
import { z } from "zod";

const mySchema = z.object({
  name: z.string(),
});

export const myFeatureRouter = router({
  create: protectedProcedure
    .input(mySchema)
    .mutation(async ({ ctx, input }) => {
      // Implementation
    }),

  list: protectedProcedure
    .query(async ({ ctx }) => {
      // Implementation
    }),
});
```

### 2. Add to Main Router

```ts
// src/server/routers/_app.ts
import { myFeatureRouter } from "./myFeature";

export const appRouter = router({
  // ... existing routers
  myFeature: myFeatureRouter,
});
```

### 3. Use in Client

```tsx
const { data } = trpc.myFeature.list.useQuery();
const createMutation = trpc.myFeature.create.useMutation();
```

## Router Organization

For large routers (>200 lines), split into sub-modules:

```
src/server/routers/myFeature/
├── index.ts      - Combines all sub-routers
├── core.ts       - Core CRUD operations
├── advanced.ts   - Complex operations
└── utils.ts      - Shared helpers
```

Example: See `src/server/routers/households/` for reference.

## Request Batching

Multiple queries/mutations are automatically batched into a single HTTP request:

```tsx
// These will be batched into ONE HTTP request
const { data: households } = trpc.households.getCurrent.useQuery();
const { data: members } = trpc.households.getMembers.useQuery();
const { data: invites } = trpc.households.getInvites.useQuery();
```

## TypeScript Tips

### Inferring Types

```ts
import type { AppRouter } from "@/server/routers/_app";
import type { inferRouterOutputs } from "@trpc/server";

// Infer output types
type RouterOutput = inferRouterOutputs<AppRouter>;
type Household = RouterOutput['households']['getCurrent']['household'];
```

### Context Type

```ts
import type { Context } from "@/server/trpc";

// Use in helpers
async function myHelper(ctx: Context) {
  const userId = ctx.session?.user?.id;
}
```

## Testing

Currently no tests exist. Recommended test structure:

```ts
// tests/routers/households.test.ts
import { createCallerFactory } from "@trpc/server";
import { appRouter } from "@/server/routers/_app";

const createCaller = createCallerFactory(appRouter);

describe("households router", () => {
  it("creates a household", async () => {
    const ctx = { /* mock context */ };
    const caller = createCaller(ctx);

    const result = await caller.households.create({ name: "Test" });
    expect(result.household.name).toBe("Test");
  });
});
```

## Performance Tips

1. **Use Prisma directly in Server Components** - Avoid HTTP overhead
2. **Set appropriate stale times** - Reduce unnecessary refetches
3. **Use query invalidation** - Instead of refetchOnWindowFocus
4. **Consider pagination** - For large datasets (not yet implemented)
5. **Profile with Prisma query logging** - Identify N+1 queries

## Common Patterns

### Optimistic Updates

```tsx
const utils = trpc.useUtils();

const updateMutation = trpc.households.updateCurrent.useMutation({
  onMutate: async (newData) => {
    // Cancel outgoing refetches
    await utils.households.getCurrent.cancel();

    // Snapshot previous value
    const prev = utils.households.getCurrent.getData();

    // Optimistically update
    utils.households.getCurrent.setData(undefined, (old) => ({
      household: { ...old!.household, ...newData }
    }));

    return { prev };
  },
  onError: (err, newData, context) => {
    // Rollback on error
    utils.households.getCurrent.setData(undefined, context!.prev);
  },
  onSettled: () => {
    // Refetch after mutation
    utils.households.getCurrent.invalidate();
  },
});
```

### Dependent Queries

```tsx
// Only fetch members if household is loaded
const { data: household } = trpc.households.getCurrent.useQuery();

const { data: members } = trpc.households.getMembers.useQuery(undefined, {
  enabled: !!household, // Only run if household exists
});
```

### Infinite Queries (Future)

```tsx
// Not yet implemented, but TanStack Query supports it
const { data, fetchNextPage, hasNextPage } = trpc.logs.list.useInfiniteQuery(
  { limit: 20 },
  {
    getNextPageParam: (lastPage) => lastPage.nextCursor,
  },
);
```

## Troubleshooting

### Type Errors

If you see type errors after changing routers:
```bash
# Restart TypeScript server in VSCode
# Cmd+Shift+P -> "TypeScript: Restart TS Server"
```

### Stale Cache

If data seems outdated:
```tsx
// Force refetch
const { refetch } = trpc.myQuery.useQuery();
refetch();

// Or invalidate
utils.myQuery.invalidate();
```

### CORS Errors

Make sure requests come from the same origin. The tRPC endpoint validates the `Origin` header.

## Resources

- [tRPC Documentation](https://trpc.io/docs)
- [TanStack Query Documentation](https://tanstack.com/query/latest/docs/react/overview)
- [SuperJSON Documentation](https://github.com/blitz-js/superjson)
- [Zod Documentation](https://zod.dev/)
