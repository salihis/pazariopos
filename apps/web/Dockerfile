# apps/web/Dockerfile
# ─────────────────────────────────────────────────────────────
# Build context MUST be the repo ROOT (same reason as server/Dockerfile
# — packages/ui and packages/core are pnpm workspace dependencies):
#   docker build -f apps/web/Dockerfile -t pazariopos-web .
# (deploy/docker-compose.pazariopos.yml already sets this up correctly.)
# ─────────────────────────────────────────────────────────────

FROM node:20-alpine AS build
RUN npm install -g pnpm@9.7.0
WORKDIR /repo
COPY . .
RUN pnpm install --frozen-lockfile
RUN pnpm turbo run build --filter=@pazariopos/web

FROM nginx:alpine AS runtime
COPY --from=build /repo/apps/web/dist /usr/share/nginx/html
COPY apps/web/nginx.internal.conf /etc/nginx/conf.d/default.conf
EXPOSE 80
