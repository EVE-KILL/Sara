# Build stage with build tools
FROM oven/bun:alpine AS builder
WORKDIR /app

# Install build dependencies for native modules
RUN apk add --no-cache \
    python3 \
    make \
    g++ \
    cairo-dev \
    pango-dev \
    libjpeg-turbo-dev \
    giflib-dev \
    librsvg-dev \
    pixman-dev \
    pangomm-dev \
    libjpeg-turbo-dev \
    freetype-dev

# Copy package files
COPY package.json bun.lock* ./

# Install dependencies with build tools available
RUN bun install --frozen-lockfile

# Copy source code
COPY . .

# Production stage - clean Alpine image
FROM oven/bun:alpine AS production
WORKDIR /app

# Install only runtime dependencies for native modules
RUN apk add --no-cache \
    cairo \
    pango \
    libjpeg-turbo \
    giflib \
    librsvg \
    pixman

# Create non-root user for security
RUN addgroup -g 1001 -S sara && \
    adduser -S sara -u 1001

# Copy built application from builder
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/package.json ./package.json
COPY --from=builder /app/*.ts ./
COPY --from=builder /app/onInteraction ./onInteraction
COPY --from=builder /app/onMessage ./onMessage
COPY --from=builder /app/tools ./tools
COPY --from=builder /app/tasks ./tasks

# Create necessary directories with proper permissions
RUN mkdir -p /app/temp /app/logs && \
    chown -R sara:sara /app

# Switch to non-root user
USER sara

# Health check to ensure bot is running properly
HEALTHCHECK --interval=30s --timeout=10s --start-period=5s --retries=3 \
    CMD bun run cli.ts --health-check || exit 1

# Start the Sara Discord bot
CMD ["bun", "run", "bot.ts"]
