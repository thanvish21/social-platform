FROM node:20-alpine AS base
WORKDIR /app

# ─── Install deps (workspace-aware) ──────────────────────────
FROM base AS deps
COPY package.json package-lock.json* ./
COPY server/package.json ./server/
RUN npm install --workspace=server --omit=dev=false

# ─── Build ───────────────────────────────────────────────────
FROM base AS build
COPY package.json package-lock.json* ./
COPY server/package.json ./server/
RUN npm install --workspace=server
COPY server ./server
RUN npm run build --workspace=server

# ─── Runtime ─────────────────────────────────────────────────
FROM base AS runtime
ENV NODE_ENV=production
COPY package.json ./
COPY server/package.json ./server/
COPY --from=build /app/node_modules ./node_modules
COPY --from=build /app/server/dist ./server/dist
WORKDIR /app/server
EXPOSE 4000
CMD ["node", "dist/index.js"]
