# syntax=docker/dockerfile:1

# Stage 1: Base image with dependencies
FROM node:20-alpine AS base

# Install necessary build tools for native dependencies
RUN apk add --no-cache \
    python3 \
    make \
    g++ \
    sqlite \
    sqlite-dev

WORKDIR /app

# Copy package files for all workspaces
COPY package*.json ./
COPY turbo.json ./

# Copy each package's package.json
COPY packages/adapters/package.json ./packages/adapters/
COPY packages/cli/package.json ./packages/cli/
COPY packages/common/package.json ./packages/common/
COPY packages/core/package.json ./packages/core/
COPY packages/scheduler/package.json ./packages/scheduler/

# Install dependencies
RUN npm ci --include=dev

# Stage 2: Builder - Build the application
FROM base AS builder

WORKDIR /app

# Copy source code
COPY . .

# Build all packages using turbo
RUN npm run build

# Stage 3: Production dependencies only
FROM node:20-alpine AS deps

WORKDIR /app

# Copy package files for all workspaces
COPY package*.json ./
COPY turbo.json ./

# Copy each package's package.json
COPY packages/adapters/package.json ./packages/adapters/
COPY packages/cli/package.json ./packages/cli/
COPY packages/common/package.json ./packages/common/
COPY packages/core/package.json ./packages/core/
COPY packages/scheduler/package.json ./packages/scheduler/

# Install production dependencies only
RUN npm ci --omit=dev

# Stage 4: Final production image
FROM node:20-alpine AS production

# Install runtime dependencies
RUN apk add --no-cache \
    sqlite \
    sqlite-libs \
    dumb-init

# Create non-root user
RUN addgroup -g 1001 -S recursive && \
    adduser -S recursive -u 1001

WORKDIR /app

# Copy production dependencies from deps stage
COPY --from=deps --chown=recursive:recursive /app/node_modules ./node_modules
COPY --from=deps --chown=recursive:recursive /app/package*.json ./

# Copy built application from builder stage
COPY --from=builder --chown=recursive:recursive /app/packages ./packages
COPY --from=builder --chown=recursive:recursive /app/turbo.json ./

# Create data directory for SQLite databases
RUN mkdir -p /app/data && chown -R recursive:recursive /app/data

# Create logs directory
RUN mkdir -p /app/logs && chown -R recursive:recursive /app/logs

# Switch to non-root user
USER recursive

# Set environment variables
ENV NODE_ENV=production \
    DATA_DIR=/app/data \
    LOG_DIR=/app/logs \
    PORT=3000

# Expose port (if needed for future API)
EXPOSE 3000

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=5s --retries=3 \
    CMD node -e "console.log('healthy')" || exit 1

# Use dumb-init to handle signals properly
ENTRYPOINT ["/usr/bin/dumb-init", "--"]

# Default command - run the CLI
CMD ["node", "packages/cli/dist/cli.js", "--help"]
