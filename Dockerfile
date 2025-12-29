FROM node:24.12.0-slim AS base
WORKDIR /app
ENV NEXT_TELEMETRY_DISABLED=1
RUN apt-get update \
  && apt-get install -y --no-install-recommends openssl ca-certificates \
  && rm -rf /var/lib/apt/lists/*

FROM base AS deps
RUN apt-get update \
  && apt-get install -y --no-install-recommends python3 make g++ \
  && rm -rf /var/lib/apt/lists/*
COPY package.json pnpm-workspace.yaml ./
RUN corepack enable \
  && pnpm install --no-frozen-lockfile

FROM base AS prisma-deps
WORKDIR /prisma-deps
COPY package.json pnpm-workspace.yaml ./
RUN PRISMA_VERSION=$(node -p "const pkg=require('./package.json'); pkg.devDependencies?.prisma || pkg.dependencies?.prisma || ''") \
  && if [ -z "$PRISMA_VERSION" ]; then echo "prisma version not found"; exit 1; fi \
  && printf '{ "name": "prisma-cli", "private": true, "dependencies": { "prisma": "%s" } }\n' "$PRISMA_VERSION" > /prisma-deps/package.json \
  && corepack enable \
  && pnpm install --prod --no-frozen-lockfile

FROM base AS builder
COPY --from=deps /app/node_modules ./node_modules
COPY . .
ENV DATABASE_URL="file:./dev.db"
RUN corepack enable \
  && pnpm prisma generate
RUN pnpm run build

FROM base AS runner
ENV NODE_ENV=production
ENV PORT=3000
RUN groupadd -g 1001 nextjs && useradd -m -u 1001 -g 1001 nextjs
RUN mkdir -p /data && chown nextjs:nextjs /data
ENV DATABASE_URL="file:/data/dev.db"
COPY --from=builder --chown=nextjs:nextjs /app/public ./public
COPY --from=builder --chown=nextjs:nextjs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nextjs /app/.next/static ./.next/static
COPY --from=builder --chown=nextjs:nextjs /app/prisma ./prisma
COPY --from=builder --chown=nextjs:nextjs /app/prisma.config.ts ./prisma.config.ts
COPY --from=builder --chown=nextjs:nextjs /app/package.json /app/seed/package.json
COPY --from=builder --chown=nextjs:nextjs /app/scripts /app/seed/scripts
COPY --from=builder --chown=nextjs:nextjs /app/docker-entrypoint.sh ./docker-entrypoint.sh
COPY --from=prisma-deps --chown=nextjs:nextjs /prisma-deps/node_modules /app/prisma-node_modules/node_modules
RUN chmod +x /app/docker-entrypoint.sh
USER nextjs
EXPOSE 3000
ENTRYPOINT ["./docker-entrypoint.sh"]
CMD ["node", "server.js"]
