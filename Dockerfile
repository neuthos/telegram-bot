FROM node:18-alpine AS dependencies

WORKDIR /app

RUN apk add --no-cache \
    chromium \
    nss \
    freetype \
    harfbuzz \
    ca-certificates \
    ttf-freefont

COPY package*.json ./

# Install production dependencies
RUN npm ci \
    --omit=dev \
    --no-optional \
    --no-audit \
    --no-fund \
    --ignore-scripts \
    && npm cache clean --force

FROM node:18-alpine AS builder

WORKDIR /app

COPY package*.json ./

# Install ALL dependencies (including dev) untuk build
RUN npm ci \
    --no-optional \
    --no-audit \
    --no-fund \
    --ignore-scripts

COPY tsconfig.json ./
COPY src/ ./src/

RUN NODE_OPTIONS="--max-old-space-size=2048" npm run build

FROM node:18-alpine AS production

WORKDIR /app

RUN apk add --no-cache \
    chromium \
    nss \
    freetype \
    harfbuzz \
    ca-certificates \
    ttf-freefont \
    curl

ENV PLAYWRIGHT_SKIP_BROWSER_DOWNLOAD=1 \
    PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH=/usr/bin/chromium-browser \
    NODE_ENV=production

COPY --from=dependencies /app/node_modules ./node_modules
COPY --from=dependencies /app/package*.json ./
COPY --from=builder /app/dist ./dist

RUN mkdir -p logs uploads/kyc public/pdfs && \
    addgroup -g 1001 -S nodejs && \
    adduser -S appuser -u 1001 -G nodejs && \
    chown -R appuser:nodejs /app

USER appuser

EXPOSE 3000

HEALTHCHECK --interval=30s --timeout=30s --start-period=10s --retries=3 \
    CMD curl -f http://localhost:3000/health || exit 1

CMD ["npm", "start"]