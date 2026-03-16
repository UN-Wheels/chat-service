# ==========================================
#  Multi-stage build — UniWheels Chat Service
# ==========================================

# --- Stage 1: Builder ---
FROM node:18-alpine AS builder

WORKDIR /app

COPY package*.json ./
RUN npm ci

COPY tsconfig.json nest-cli.json ./
COPY src/ ./src/

RUN npm run build

# --- Stage 2: Production runtime ---
FROM node:18-alpine AS runtime

RUN addgroup -S appgroup && adduser -S appuser -G appgroup

WORKDIR /app

COPY package*.json ./
RUN npm ci --only=production && npm cache clean --force

COPY --from=builder /app/dist ./dist

RUN chown -R appuser:appgroup /app
USER appuser

EXPOSE 3001

CMD ["node", "dist/main"]
