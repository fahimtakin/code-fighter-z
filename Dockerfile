# syntax=docker/dockerfile:1

# ---- deps: install everything (isolated-vm and bcrypt are native modules) ----
FROM node:24-bookworm-slim AS deps
WORKDIR /app
RUN apt-get update \
  && apt-get install -y --no-install-recommends python3 make g++ \
  && rm -rf /var/lib/apt/lists/*
COPY package.json package-lock.json ./
RUN npm ci

# ---- build: compile the Next.js app, then drop dev dependencies ----
FROM deps AS build
COPY . .
RUN npm run build && npm prune --omit=dev

# ---- runtime: small image, non-root user, no compilers ----
FROM node:24-bookworm-slim AS runtime
WORKDIR /app
ENV NODE_ENV=production PORT=3000
COPY --from=build --chown=node:node /app ./
USER node
EXPOSE 3000
HEALTHCHECK --interval=15s --timeout=3s --start-period=20s \
  CMD node -e "fetch('http://localhost:3000/api/health').then(r => process.exit(r.ok ? 0 : 1)).catch(() => process.exit(1))"
# Apply pending migrations, then `exec` so Node is PID 1 and receives SIGTERM for graceful shutdown.
CMD ["sh", "-c", "node --import tsx scripts/migrate.ts && exec node --no-node-snapshot --import tsx server.ts"]
