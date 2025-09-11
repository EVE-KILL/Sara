# Use the official Bun image as base
FROM oven/bun:alpine AS base
WORKDIR /app

# Install dependencies stage
FROM base AS install
RUN mkdir -p /temp/dev
COPY package.json bun.lock* /temp/dev/
RUN cd /temp/dev && bun install --frozen-lockfile

# Copy source code and prepare for production
FROM base AS prerelease
COPY --from=install /temp/dev/node_modules node_modules
COPY . .

# Production stage
FROM base AS release
COPY --from=install /temp/dev/node_modules node_modules
COPY --from=prerelease /app .

# Create non-root user for security
RUN addgroup -g 1001 -S sara && \
    adduser -S sara -u 1001 && \
    mkdir -p /app/temp && \
    chown -R sara:sara /app

# Create necessary directories with proper permissions
RUN mkdir -p /app/temp /app/logs && \
    chown -R sara:sara /app/temp /app/logs

USER sara

# Health check to ensure bot is running properly
HEALTHCHECK --interval=30s --timeout=10s --start-period=5s --retries=3 \
    CMD bun run cli.ts --health-check || exit 1

# Start the Sara Discord bot
CMD ["bun", "run", "bot.ts"]
