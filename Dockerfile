FROM node:18-alpine AS dependencies

WORKDIR /app

RUN apk add --no-cache \
    python3 \
    make \
    g++ \
    chromium \
    && npm config set cache /tmp/.npm

COPY package*.json ./

RUN npm ci \
    --prefer-offline \
    --no-audit \
    --no-fund \
    --ignore-scripts \
    && npm rebuild \
    && npm cache clean --force

FROM node:18-alpine AS builder

WORKDIR /app

COPY --from=dependencies /app/node_modules ./node_modules
COPY package*.json tsconfig.json ./
COPY src/ ./src/

RUN NODE_OPTIONS="--max-old-space-size=2048" npm run build

FROM node:18-alpine AS production

WORKDIR /app

RUN apk add --no-cache chromium nss freetype harfbuzz ca-certificates ttf-freefont curl

ENV PUPPETEER_SKIP_CHROMIUM_DOWNLOAD=true \
    PUPPETEER_EXECUTABLE_PATH=/usr/bin/chromium-browser \
    NODE_ENV=production

COPY package*.json ./
RUN npm ci --only=production --no-audit --no-fund && npm cache clean --force

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