FROM node:20-bookworm-slim AS base
WORKDIR /app
ENV NEXT_TELEMETRY_DISABLED=1

FROM base AS deps
RUN apt-get update \
  && apt-get install -y openssl \
  && rm -rf /var/lib/apt/lists/*
COPY package.json package-lock.json ./
RUN npm ci

FROM base AS builder
COPY --from=deps /app/node_modules ./node_modules
COPY . .
ENV DATABASE_URL="file:./dev.db"
RUN npx prisma generate
RUN npm run build

FROM base AS runner
ENV NODE_ENV=production
RUN apt-get update \
  && apt-get install -y openssl \
  && rm -rf /var/lib/apt/lists/*
RUN useradd --system --uid 1001 nextjs
RUN mkdir -p /data && chown nextjs:nextjs /data
ENV DATABASE_URL="file:/data/dev.db"
COPY --from=builder /app/package.json ./package.json
COPY --from=builder /app/node_modules ./node_modules
RUN npm prune --omit=dev
COPY --from=builder /app/public ./public
COPY --from=builder /app/.next ./.next
USER nextjs
EXPOSE 3000
CMD ["npm", "start"]
