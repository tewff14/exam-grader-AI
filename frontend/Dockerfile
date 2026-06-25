FROM node:22-slim AS deps
WORKDIR /app
COPY package.json package-lock.json ./
# `npm ci` rejects this lockfile over a nested-vs-hoisted @emnapi/* version
# mismatch coming from @tailwindcss/oxide's wasm32-wasi fallback packages;
# `npm install` resolves it without needing to touch the lockfile itself.
RUN npm install

FROM node:22-slim AS builder
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .
# NEXT_PUBLIC_* vars are inlined into the client bundle at build time, so this
# must be the URL the *browser* can reach, not an internal Docker hostname.
ARG NEXT_PUBLIC_API_BASE=http://localhost:8002
ENV NEXT_PUBLIC_API_BASE=$NEXT_PUBLIC_API_BASE
RUN npm run build

FROM node:22-slim AS runner
WORKDIR /app
ENV NODE_ENV=production
COPY --from=builder /app/public ./public
COPY --from=builder /app/.next/standalone ./
COPY --from=builder /app/.next/static ./.next/static

EXPOSE 3000

CMD ["node", "server.js"]
