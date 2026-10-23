# syntax=docker/dockerfile:1
# Pinned to an exact Node LTS release on Debian slim (glibc: the Prisma schema
# engine used by `migrate deploy` ships prebuilt for it).
ARG NODE_IMAGE=node:24.11.1-bookworm-slim

# ---- deps: full dependency tree (dev deps are needed to build and to migrate) ----
FROM ${NODE_IMAGE} AS deps
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci --ignore-scripts

# ---- build: Prisma client + compiled app -----------------------------------------
FROM deps AS build
COPY . .
# No DATABASE_URL here on purpose: prisma.config.ts then picks the PostgreSQL schema.
RUN npx prisma generate && npm run build

# ---- prod-deps: runtime dependencies only (no better-sqlite3, no Prisma CLI) -------
FROM ${NODE_IMAGE} AS prod-deps
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci --omit=dev --ignore-scripts && npm cache clean --force

# ---- migrate: one-shot job — apply migrations, then the idempotent seed ------------
FROM ${NODE_IMAGE} AS migrate
# The Prisma schema engine needs OpenSSL; slim images do not include it.
RUN apt-get update \
  && apt-get install -y --no-install-recommends openssl \
  && rm -rf /var/lib/apt/lists/*
WORKDIR /app
ENV NODE_ENV=production
COPY --from=deps --chown=node:node /app/node_modules ./node_modules
COPY --chown=node:node package.json prisma.config.ts tsconfig.json ./
COPY --chown=node:node prisma ./prisma
COPY --chown=node:node src/common/prisma/prisma-client.factory.ts ./src/common/prisma/
COPY --from=build --chown=node:node /app/src/generated ./src/generated
USER node
# `npm ci --ignore-scripts` skipped Prisma's engine download; fetch the schema engine
# now so the job needs no internet access at startup.
RUN npx --no-install prisma version
CMD ["sh", "-c", "npx --no-install prisma migrate deploy && npx --no-install tsx prisma/seed.ts"]

# ---- runtime: the API ----------------------------------------------------------------
FROM ${NODE_IMAGE} AS runtime
WORKDIR /app
ENV NODE_ENV=production PORT=3000
# Owned by root, run as node: the process cannot modify its own code or
# dependencies (compose also mounts the root filesystem read-only).
COPY --from=prod-deps /app/node_modules ./node_modules
COPY --from=build /app/dist ./dist
COPY package.json ./
USER node
EXPOSE 3000
HEALTHCHECK --interval=10s --timeout=3s --start-period=20s --retries=5 \
  CMD ["node", "-e", "fetch('http://127.0.0.1:3000/api/health').then(r => process.exit(r.ok ? 0 : 1)).catch(() => process.exit(1))"]
CMD ["node", "dist/main"]
