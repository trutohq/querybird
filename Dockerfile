# Multi-stage build for QueryBird
FROM oven/bun:1.1-alpine AS builder

# Set working directory
WORKDIR /app

# Copy package files
COPY package.json bun.lockb* ./

# Install dependencies
RUN bun install --frozen-lockfile --production

# Copy source code
COPY src/ ./src/
COPY tsconfig.json ./

# Build the application
RUN bun build src/main-runner.ts --outdir dist --target bun --minify

# Production stage
FROM oven/bun:1.1-alpine AS runtime

# Install dumb-init for proper signal handling
RUN apk add --no-cache dumb-init

# Create non-root user
RUN addgroup -g 1001 -S querybird && \
    adduser -S querybird -u 1001 -G querybird

# Set working directory
WORKDIR /app

# Copy built application and dependencies from builder
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/package.json ./

# Create directories for configs, secrets, and logs
RUN mkdir -p .querybird/configs .querybird/secrets .querybird/logs && \
    chown -R querybird:querybird .querybird

# Copy entrypoint script
COPY docker/entrypoint.sh ./entrypoint.sh
RUN chmod +x entrypoint.sh

# Switch to non-root user
USER querybird

# Set environment variables
ENV NODE_ENV=production
ENV QB_CONFIG_DIR=/app/.querybird
ENV LOG_LEVEL=info

# Expose health check endpoint (if implemented)
EXPOSE 8080

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=5s --retries=3 \
  CMD bun run dist/main-runner.js health || exit 1

# Use dumb-init as entrypoint for proper signal handling
ENTRYPOINT ["dumb-init", "--", "/app/entrypoint.sh"]

# Default command
CMD ["start"]