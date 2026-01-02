# tRPC Guide

Type-safe API layer using [tRPC](https://trpc.io/) + [TanStack Query](https://tanstack.com/query).

## Key Files

- `src/lib/trpc/client.ts` - Server-side client (vanilla)
- `src/lib/trpc/react.tsx` - Client-side hooks + provider
- `src/server/trpc.ts` - tRPC instance + middleware
- `src/server/routers/_app.ts` - Main router
- `src/app/api/trpc/[trpc]/route.ts` - Next.js handler

## Client Usage

```tsx
import { trpc } from "@/lib/trpc/react";

// Query
const { data, isLoading } = trpc.households.getCurrent.useQuery();

// Mutation
const updateMutation = trpc.households.update.useMutation({
  onSuccess: () => utils.households.getCurrent.invalidate(),
});

// Cache invalidation
const utils = trpc.useUtils();
utils.households.getCurrent.invalidate(); // Specific
utils.households.invalidate(); // All household queries
```

## Server Components

**⚠️ Use Prisma directly, NOT tRPC client** (avoid HTTP overhead)

```ts
// ✅ DO
import { prisma } from "@/lib/prisma";
const household = await prisma.household.findUnique({ where: { id } });

// ❌ DON'T
import { trpcClient } from "@/lib/trpc/client";
const result = await trpcClient.households.getCurrent.query();
```

## Cache Configuration

**Defaults**: `staleTime: 30s`, `refetchOnWindowFocus: false`, `retry: 3`

**Override per query**:
```tsx
const { data } = trpc.households.getCurrent.useQuery(undefined, {
  staleTime: 60_000, // 1 minute
});
```

**Recommendations**:
- Static data: 5-10min or `Infinity`
- User data: 30-60s
- Real-time: 0-5s

## SuperJSON

Automatically serializes: `Date`, `undefined`, `BigInt`, `Map`, `Set`, `RegExp`

```ts
// Server returns Date, client receives Date (not string!)
return { createdAt: new Date() };
```

## Procedures

```ts
publicProcedure           // No auth
protectedProcedure        // Authenticated user
householdProcedure        // + household membership (requires householdId input)
approverProcedure         // + APPROVER/DICTATOR role (requires householdId input)
dictatorProcedure         // + DICTATOR role (requires householdId input)
superAdminProcedure       // Super admin only
```

**Household procedures** require `householdId: z.string().min(1)` in input schema.

## Input Validation

```ts
const schema = z.object({
  householdId: z.string().min(1),
  name: z.string().trim().min(2).max(50),
});

export const myRouter = router({
  update: protectedProcedure
    .input(schema)
    .mutation(async ({ ctx, input }) => {
      // MUST manually validate household membership
      const { householdId, membership } = await validateHouseholdMembershipFromInput(
        ctx.session.user.id,
        input
      );
      // Now safe to use
    }),
});
```

## Error Handling

**Production**: Errors sanitized to prevent info leakage (configured in `src/lib/errorSanitization.ts`)

**Dev**: Warnings for potentially sensitive messages

```ts
throw new TRPCError({
  code: "NOT_FOUND", // UNAUTHORIZED, FORBIDDEN, BAD_REQUEST, etc.
  message: "Household not found",
});
```

## Security

**CSRF**: Validates `Origin`/`Referer` headers for mutations

**Rate Limiting**: Join household requests (5 per 60s, configurable)

**Request Size**: 1MB max (configurable in `config.ts`)

## Creating Routers

```ts
// src/server/routers/myFeature.ts
import "server-only";
import { router, protectedProcedure } from "@/server/trpc";
import { z } from "zod";

export const myFeatureRouter = router({
  create: protectedProcedure
    .input(z.object({ name: z.string() }))
    .mutation(async ({ ctx, input }) => {
      // Implementation
    }),
});
```

```ts
// src/server/routers/_app.ts
import { myFeatureRouter } from "./myFeature";

export const appRouter = router({
  myFeature: myFeatureRouter,
});
```

**Large routers**: Split into sub-modules (see `src/server/routers/households/`)

## Common Patterns

**Optimistic updates**:
```tsx
const updateMutation = trpc.households.update.useMutation({
  onMutate: async (newData) => {
    await utils.households.getCurrent.cancel();
    const prev = utils.households.getCurrent.getData();
    utils.households.getCurrent.setData(undefined, (old) => ({
      household: { ...old!.household, ...newData }
    }));
    return { prev };
  },
  onError: (err, newData, context) => {
    utils.households.getCurrent.setData(undefined, context!.prev);
  },
  onSettled: () => utils.households.getCurrent.invalidate(),
});
```

**Dependent queries**:
```tsx
const { data: household } = trpc.households.getCurrent.useQuery();
const { data: members } = trpc.households.getMembers.useQuery(undefined, {
  enabled: !!household, // Only run if household exists
});
```

**Request batching**: Multiple queries/mutations automatically batched into single HTTP request

## Troubleshooting

**Type errors**: Restart TypeScript server (`Cmd+Shift+P` → "TypeScript: Restart TS Server")

**Stale cache**: Force refetch with `refetch()` or `utils.invalidate()`

**CORS errors**: Ensure same-origin requests (tRPC validates `Origin` header)

## Resources

- [tRPC Docs](https://trpc.io/docs)
- [TanStack Query Docs](https://tanstack.com/query)
- [SuperJSON](https://github.com/blitz-js/superjson)
- [Zod](https://zod.dev/)
