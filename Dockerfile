# Use a more specific and secure base image
FROM node:22.5.1-bookworm-slim

# Create a non-root user for security
RUN groupadd -r appuser && useradd -r -g appuser appuser

# Install system dependencies and clean up in one layer
RUN apt-get update \
    && apt-get upgrade -y \
    && apt-get install -y --no-install-recommends \
        openssl \
        ca-certificates \
    && apt-get clean \
    && rm -rf /var/lib/apt/lists/*

# Set working directory
WORKDIR /app

# Copy package files first for better layer caching
COPY package*.json ./

# Install dependencies with production optimizations
RUN npm ci --only=production \
    && npm cache clean --force

# Copy application code
COPY . .

# Create necessary directories and set permissions
RUN mkdir -p /app/logs \
    && chown -R appuser:appuser /app

# Switch to non-root user
USER appuser

# Environment variables with defaults
ENV NODE_ENV=production
ENV PORT=3000
ENV ROOT_DIR=/app

# Database environment variables (will be overridden at runtime)
ENV PGHOST=localhost
ENV PGUSER=postgres
ENV PGPASSWORD=
ENV PGDATABASE=prompt_evaluator
ENV PGPORT=5432

# ADMIN_PASS
ENV CLIENT_ADMIN_PASS=

# OpenAI API key (must be provided at runtime)
ENV OPENAI_API_KEY=

# Expose port
EXPOSE 3000

# Use a more robust startup command
CMD ["node", "server.js"]