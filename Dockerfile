# syntax=docker/dockerfile:1

# Build and run the dashboard + API. Three stages so the final image carries
# neither the package manager nor the source — only the traced standalone
# server, which is a fraction of the size and attack surface.

FROM node:22-alpine AS deps
RUN corepack enable
WORKDIR /app
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY packages/sdk/package.json ./packages/sdk/
COPY packages/mcp/package.json ./packages/mcp/
# Flat node_modules for this image only. Next's standalone output traces the
# files the server needs and copies them; with pnpm's symlinked store that
# trace misses transitive deps reached through symlinks — @swc/helpers is the
# one that surfaces first, as a MODULE_NOT_FOUND at boot rather than a build
# error. Hoisting makes the trace resolve everything it walks.
RUN printf "node-linker=hoisted\n" > .npmrc && pnpm install --frozen-lockfile

FROM node:22-alpine AS build
RUN corepack enable
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY --from=deps /app/packages ./packages
COPY . .
# Build-time env only; nothing secret is baked in. Real values arrive at run time.
ENV NEXT_TELEMETRY_DISABLED=1
RUN pnpm build

FROM node:22-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production NEXT_TELEMETRY_DISABLED=1 PORT=3000
RUN addgroup -g 1001 -S nodejs && adduser -S -u 1001 -G nodejs memora

COPY --from=build /app/.next/standalone ./
COPY --from=build /app/.next/static ./.next/static
COPY --from=build /app/public ./public
# Migrations travel with the image so a deploy and its schema cannot drift.
COPY --from=build /app/drizzle ./drizzle

USER memora
EXPOSE 3000

HEALTHCHECK --interval=30s --timeout=5s --start-period=20s --retries=3 \
  CMD node -e "fetch('http://127.0.0.1:3000/api/v1/health').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"

CMD ["node", "server.js"]
