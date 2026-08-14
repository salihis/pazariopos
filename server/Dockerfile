# server/Dockerfile
# ─────────────────────────────────────────────────────────────
# Multi-stage build for the Fastify server. Build context MUST be the
# repo ROOT (not server/), because this depends on @pazariopos/core
# via the pnpm workspace protocol:
#   docker build -f server/Dockerfile -t pazariopos-server .
# (deploy/docker-compose.pazariopos.yml already sets this up correctly.)
#
# Deliberately copies the whole built /repo into the runtime stage
# rather than doing a slimmed-down "prod only" reinstall — pnpm
# workspace hoisting makes a clean prod-only copy fragile to get
# right, and image size isn't a real constraint for this app's scale.
# Correctness over slimness.
# ─────────────────────────────────────────────────────────────

FROM node:20-alpine AS build
RUN npm install -g pnpm@9.7.0
WORKDIR /repo
COPY . .
RUN pnpm install --frozen-lockfile
RUN pnpm --filter @pazariopos/server exec prisma generate
RUN pnpm turbo run build --filter=@pazariopos/server

FROM node:20-alpine AS runtime
WORKDIR /repo
COPY --from=build /repo /repo
WORKDIR /repo/server
EXPOSE 3000
# No .env file is copied in on purpose — real config comes from
# docker-compose's `environment:` block (see deploy/docker-compose.pazariopos.yml).
# dotenv/config (loaded first thing in src/main.ts) simply finds no
# .env file here and no-ops; it never overrides variables Docker has
# already injected.
CMD ["node", "dist/main.js"]
