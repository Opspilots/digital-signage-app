# ── Stage 1: build ──────────────────────────────────────────────────────────
FROM node:20-alpine AS builder
WORKDIR /app

# Build tools required by better-sqlite3 native addon
RUN apk add --no-cache python3 make g++

COPY package*.json ./
RUN npm ci

COPY tsconfig.json ./
COPY src ./src
RUN npm run build

# ── Stage 2: production runtime ──────────────────────────────────────────────
FROM node:20-alpine AS runner
WORKDIR /app

# Build tools required to compile better-sqlite3 native addon in production deps
RUN apk add --no-cache python3 make g++

COPY package*.json ./
RUN npm ci --omit=dev

# Copy compiled output from builder
COPY --from=builder /app/dist ./dist

# Pre-create persistent directories (overridden by volume mounts at runtime)
RUN mkdir -p data uploads

EXPOSE 3001

CMD ["node", "dist/index.js"]
