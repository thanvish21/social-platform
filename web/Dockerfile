FROM node:20-alpine AS base
WORKDIR /app

# ─── Deps ────────────────────────────────────────────────────
FROM base AS deps
COPY package.json package-lock.json* ./
COPY web/package.json ./web/
RUN npm install --workspace=web

# ─── Build ───────────────────────────────────────────────────
FROM base AS build
ARG NEXT_PUBLIC_GRAPHQL_HTTP
ARG NEXT_PUBLIC_GRAPHQL_WS
ENV NEXT_PUBLIC_GRAPHQL_HTTP=$NEXT_PUBLIC_GRAPHQL_HTTP
ENV NEXT_PUBLIC_GRAPHQL_WS=$NEXT_PUBLIC_GRAPHQL_WS
COPY package.json package-lock.json* ./
COPY web/package.json ./web/
RUN npm install --workspace=web
COPY web ./web
RUN npm run build --workspace=web

# ─── Runtime (standalone output) ─────────────────────────────
FROM base AS runtime
ENV NODE_ENV=production
COPY --from=build /app/web/.next/standalone ./
COPY --from=build /app/web/.next/static ./web/.next/static
COPY --from=build /app/web/public ./web/public
EXPOSE 3000
CMD ["node", "web/server.js"]
