# syntax = docker/dockerfile:1
# One image for Fly.io: the rehearsal server (Node runs its TypeScript directly) serving the exported web app,
# its RPC API and the WebSocket change feed from the same origin.

ARG NODE_VERSION=24
FROM node:${NODE_VERSION}-slim AS base
WORKDIR /app

# ── Build the web app ──
FROM base AS web
COPY package.json package-lock.json ./
RUN npm ci
COPY . .
# The served web app talks to the server that serves it.
ENV EXPO_PUBLIC_SERVER_URL=same-origin
RUN npx expo export -p web

# ── Server dependencies ──
FROM base AS server
COPY server/package.json server/package-lock.json ./server/
RUN npm ci --prefix server --omit=dev

# ── Runtime ──
FROM base
ENV NODE_ENV=production PORT=8080 DATA_DIR=/data WEB_DIR=/app/dist
COPY --from=server /app/server/node_modules ./server/node_modules
COPY server/package.json ./server/
COPY server/src ./server/src
COPY shared ./shared
COPY --from=web /app/dist ./dist
EXPOSE 8080
CMD ["node", "server/src/index.ts"]
