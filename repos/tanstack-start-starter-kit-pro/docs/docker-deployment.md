# Docker Deployment Guide

This guide covers how to deploy the application using Docker and Docker Compose.

## Table of Contents

- [Prerequisites](#prerequisites)
- [Docker Setup](#docker-setup)
- [Creating a Dockerfile](#creating-a-dockerfile)
- [Production Docker Compose](#production-docker-compose)
- [Building and Running](#building-and-running)
- [Environment Configuration](#environment-configuration)
- [Database Migrations](#database-migrations)
- [Best Practices](#best-practices)
- [Troubleshooting](#troubleshooting)

## Prerequisites

- **Docker** 20.10+ installed
- **Docker Compose** 2.0+ installed
- Basic understanding of Docker concepts
- Production environment variables ready

## Docker Setup

### Current State

The project currently includes:

- [docker-compose.yml](../docker-compose.yml) - PostgreSQL for local development only
- [database.env](../database.env) - Local database credentials

**Missing**:

- Dockerfile for the application
- Production Docker Compose configuration
- .dockerignore file

This guide will help you create these missing files.

## Creating a Dockerfile

Create a `Dockerfile` in the project root:

```dockerfile
# Base stage - dependencies
FROM node:20-alpine AS base

# Enable pnpm
ENV PNPM_HOME="/pnpm"
ENV PATH="$PNPM_HOME:$PATH"
RUN corepack enable

WORKDIR /app

# Dependencies stage
FROM base AS deps

# Copy package files
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY apps/web/package.json ./apps/web/
COPY packages/*/package.json ./packages/*/
COPY tooling/*/package.json ./tooling/*/

# Install dependencies
RUN --mount=type=cache,id=pnpm,target=/pnpm/store \
    pnpm install --frozen-lockfile --prod=false

# Builder stage
FROM base AS builder

WORKDIR /app

# Copy dependencies
COPY --from=deps /app/node_modules ./node_modules
COPY --from=deps /app/apps/web/node_modules ./apps/web/node_modules
COPY --from=deps /app/packages ./packages

# Copy source code
COPY . .

# Build the application
RUN pnpm build:web

# Production stage
FROM node:20-alpine AS runner

WORKDIR /app

# Install dumb-init for proper signal handling
RUN apk add --no-cache dumb-init

# Create a non-root user
RUN addgroup --system --gid 1001 nodejs && \
    adduser --system --uid 1001 appuser

# Copy built application
COPY --from=builder --chown=appuser:nodejs /app/apps/web/.output ./.output

# Set environment
ENV NODE_ENV=production
ENV PORT=3000

# Switch to non-root user
USER appuser

# Expose port
EXPOSE 3000

# Health check
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
    CMD node -e "require('http').get('http://localhost:3000/api/health', (r) => {process.exit(r.statusCode === 200 ? 0 : 1)})"

# Start the application
CMD ["dumb-init", "node", ".output/server/index.mjs"]
```

### Create .dockerignore

Create a `.dockerignore` file in the project root to exclude unnecessary files:

```
# Dependencies
node_modules
.pnpm-store

# Build outputs
.output
dist
.turbo
.next
.vercel

# Development files
.env
.env.local
.env.*.local

# Git
.git
.gitignore

# IDE
.vscode
.idea
*.swp
*.swo

# OS
.DS_Store
Thumbs.db

# Logs
logs
*.log
npm-debug.log*
pnpm-debug.log*

# Testing
coverage
.nyc_output

# Documentation (optional)
docs
*.md
!README.md

# Docker
docker-compose.yml
Dockerfile
.dockerignore
```

## Production Docker Compose

Create `docker-compose.prod.yml` for production deployment:

```yaml
version: '3.9'

services:
  # PostgreSQL Database
  database:
    image: postgres:16-alpine
    container_name: saas-ui-db
    restart: unless-stopped
    environment:
      POSTGRES_USER: ${POSTGRES_USER:-postgres}
      POSTGRES_PASSWORD: ${POSTGRES_PASSWORD}
      POSTGRES_DB: ${POSTGRES_DB:-production}
    volumes:
      - postgres_data:/var/lib/postgresql/data
      - ./scripts/init-db.sh:/docker-entrypoint-initdb.d/init-db.sh
    ports:
      - '5432:5432'
    healthcheck:
      test: ['CMD-SHELL', 'pg_isready -U ${POSTGRES_USER:-postgres}']
      interval: 10s
      timeout: 5s
      retries: 5
    networks:
      - app-network

  # Application
  app:
    build:
      context: .
      dockerfile: Dockerfile
      target: runner
    container_name: saas-ui-app
    restart: unless-stopped
    depends_on:
      database:
        condition: service_healthy
    environment:
      NODE_ENV: production
      PORT: 3000
      DATABASE_URL: postgresql://${POSTGRES_USER:-postgres}:${POSTGRES_PASSWORD}@database:5432/${POSTGRES_DB:-production}
      APP_URL: ${APP_URL}
      VITE_API_URL: ${VITE_API_URL}
      AUTH_SECRET: ${AUTH_SECRET}
      EMAIL_FROM: ${EMAIL_FROM}
      RESEND_API_KEY: ${RESEND_API_KEY}
      STRIPE_SECRET_KEY: ${STRIPE_SECRET_KEY}
      STRIPE_WEBHOOK_SECRET: ${STRIPE_WEBHOOK_SECRET}
      VITE_STRIPE_PUBLISHABLE_KEY: ${VITE_STRIPE_PUBLISHABLE_KEY}
      DEFAULT_PLAN_ID: ${DEFAULT_PLAN_ID:-free@1}
      DEFAULT_IS_FREE: ${DEFAULT_IS_FREE:-true}
    ports:
      - '3000:3000'
    healthcheck:
      test:
        [
          'CMD',
          'node',
          '-e',
          "require('http').get('http://localhost:3000/api/health', (r) => {process.exit(r.statusCode === 200 ? 0 : 1)})",
        ]
      interval: 30s
      timeout: 10s
      retries: 3
      start_period: 40s
    networks:
      - app-network
    volumes:
      # Optional: Mount logs directory
      - ./logs:/app/logs

  # Nginx Reverse Proxy (Optional)
  nginx:
    image: nginx:alpine
    container_name: saas-ui-nginx
    restart: unless-stopped
    depends_on:
      - app
    ports:
      - '80:80'
      - '443:443'
    volumes:
      - ./nginx/nginx.conf:/etc/nginx/nginx.conf:ro
      - ./nginx/ssl:/etc/nginx/ssl:ro
      - ./nginx/logs:/var/log/nginx
    networks:
      - app-network

networks:
  app-network:
    driver: bridge

volumes:
  postgres_data:
    driver: local
```

### Nginx Configuration (Optional)

Create `nginx/nginx.conf` if using the Nginx reverse proxy:

```nginx
events {
    worker_connections 1024;
}

http {
    upstream app {
        server app:3000;
    }

    # Rate limiting
    limit_req_zone $binary_remote_addr zone=api_limit:10m rate=10r/s;
    limit_req_status 429;

    server {
        listen 80;
        server_name your-domain.com;

        # Redirect HTTP to HTTPS
        return 301 https://$server_name$request_uri;
    }

    server {
        listen 443 ssl http2;
        server_name your-domain.com;

        # SSL Configuration
        ssl_certificate /etc/nginx/ssl/cert.pem;
        ssl_certificate_key /etc/nginx/ssl/key.pem;
        ssl_protocols TLSv1.2 TLSv1.3;
        ssl_ciphers HIGH:!aNULL:!MD5;

        # Security headers
        add_header X-Frame-Options "SAMEORIGIN" always;
        add_header X-Content-Type-Options "nosniff" always;
        add_header X-XSS-Protection "1; mode=block" always;
        add_header Referrer-Policy "strict-origin-when-cross-origin" always;

        # Gzip compression
        gzip on;
        gzip_vary on;
        gzip_proxied any;
        gzip_comp_level 6;
        gzip_types text/plain text/css text/xml text/javascript application/json application/javascript application/xml+rss application/rss+xml font/truetype font/opentype application/vnd.ms-fontobject image/svg+xml;

        # Client body size limit (for file uploads)
        client_max_body_size 10M;

        # Proxy settings
        location / {
            proxy_pass http://app;
            proxy_http_version 1.1;
            proxy_set_header Upgrade $http_upgrade;
            proxy_set_header Connection 'upgrade';
            proxy_set_header Host $host;
            proxy_set_header X-Real-IP $remote_addr;
            proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
            proxy_set_header X-Forwarded-Proto $scheme;
            proxy_cache_bypass $http_upgrade;

            # Timeouts
            proxy_connect_timeout 60s;
            proxy_send_timeout 60s;
            proxy_read_timeout 60s;
        }

        # Rate limiting for API endpoints
        location /api/ {
            limit_req zone=api_limit burst=20 nodelay;
            proxy_pass http://app;
            proxy_http_version 1.1;
            proxy_set_header Host $host;
            proxy_set_header X-Real-IP $remote_addr;
            proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
            proxy_set_header X-Forwarded-Proto $scheme;
        }

        # Static files caching
        location ~* \.(jpg|jpeg|png|gif|ico|css|js|svg|woff|woff2|ttf|eot)$ {
            proxy_pass http://app;
            expires 1y;
            add_header Cache-Control "public, immutable";
        }
    }
}
```

## Building and Running

### Development (Local)

Use the existing docker-compose for local PostgreSQL:

```bash
# Start database
docker-compose up -d

# Run application locally
pnpm dev:web
```

### Production Build

```bash
# Build the Docker image
docker build -t saas-ui-app:latest .

# Or build with Docker Compose
docker-compose -f docker-compose.prod.yml build
```

### Production Run

```bash
# Start all services
docker-compose -f docker-compose.prod.yml up -d

# View logs
docker-compose -f docker-compose.prod.yml logs -f

# Stop services
docker-compose -f docker-compose.prod.yml down

# Stop and remove volumes (WARNING: deletes data)
docker-compose -f docker-compose.prod.yml down -v
```

### Specific Service Commands

```bash
# Start only database
docker-compose -f docker-compose.prod.yml up -d database

# Restart application
docker-compose -f docker-compose.prod.yml restart app

# View application logs
docker-compose -f docker-compose.prod.yml logs -f app

# View database logs
docker-compose -f docker-compose.prod.yml logs -f database

# Execute command in running container
docker-compose -f docker-compose.prod.yml exec app sh
```

## Environment Configuration

### Create Production .env

Create `.env.production` file (never commit this):

```bash
# Database
POSTGRES_USER=production_user
POSTGRES_PASSWORD=<strong-secure-password>
POSTGRES_DB=production

# Application
APP_URL=https://your-domain.com
VITE_API_URL=https://your-domain.com
NODE_ENV=production

# Authentication
AUTH_SECRET=<generate-with-openssl-rand-base64-32>

# Email
EMAIL_FROM=noreply@your-domain.com
RESEND_API_KEY=<your-resend-api-key>

# Stripe
VITE_STRIPE_PUBLISHABLE_KEY=<your-stripe-publishable-key>
STRIPE_SECRET_KEY=<your-stripe-secret-key>
STRIPE_WEBHOOK_SECRET=<your-stripe-webhook-secret>

# Billing
DEFAULT_PLAN_ID=free@1
DEFAULT_IS_FREE=true
```

### Load Environment File

```bash
# Use --env-file flag
docker-compose --env-file .env.production -f docker-compose.prod.yml up -d
```

## Database Migrations

### Run Migrations After Deployment

```bash
# Option 1: Inside the app container
docker-compose -f docker-compose.prod.yml exec app sh
cd /app
pnpm db:migrate

# Option 2: From host with DATABASE_URL
export DATABASE_URL="postgresql://user:password@localhost:5432/production"
pnpm db:migrate

# Option 3: Create a migration service in docker-compose
```

### Add Migration Service to docker-compose.prod.yml

Add this service for one-time migration runs:

```yaml
migrate:
  build:
    context: .
    dockerfile: Dockerfile
    target: builder
  container_name: saas-ui-migrate
  depends_on:
    database:
      condition: service_healthy
  environment:
    DATABASE_URL: postgresql://${POSTGRES_USER:-postgres}:${POSTGRES_PASSWORD}@database:5432/${POSTGRES_DB:-production}
  command: ['pnpm', 'db:migrate']
  networks:
    - app-network
```

Run migrations:

```bash
docker-compose -f docker-compose.prod.yml run --rm migrate
```

### Seed Database (Optional)

```bash
docker-compose -f docker-compose.prod.yml exec app sh
pnpm --filter @workspace/db db:seed --email admin@example.com --password secure123
```

### Sync Billing Plans

```bash
docker-compose -f docker-compose.prod.yml exec app sh
pnpm billing:sync
```

## Best Practices

### 1. Multi-Stage Builds

The Dockerfile uses multi-stage builds to:

- Minimize final image size
- Separate build and runtime dependencies
- Improve build caching

### 2. Non-Root User

The application runs as a non-root user (`appuser`) for security.

### 3. Health Checks

Both database and application have health checks configured:

- Database: `pg_isready`
- Application: HTTP request to `/api/health` (needs to be implemented)

### 4. Proper Signal Handling

Uses `dumb-init` to properly handle signals (SIGTERM, SIGINT) for graceful shutdowns.

### 5. Volume Management

**Persistent volumes**:

- `postgres_data` - Database files
- Optional: Mount logs directory for application logs

**Backup strategy**:

```bash
# Backup database
docker-compose -f docker-compose.prod.yml exec database \
  pg_dump -U postgres production > backup-$(date +%Y%m%d).sql

# Restore database
cat backup-20240101.sql | docker-compose -f docker-compose.prod.yml exec -T database \
  psql -U postgres production
```

### 6. Resource Limits

Add resource limits to docker-compose.prod.yml:

```yaml
services:
  app:
    deploy:
      resources:
        limits:
          cpus: '2'
          memory: 2G
        reservations:
          cpus: '1'
          memory: 1G

  database:
    deploy:
      resources:
        limits:
          cpus: '2'
          memory: 2G
        reservations:
          cpus: '1'
          memory: 1G
```

### 7. Logging

Configure logging drivers:

```yaml
services:
  app:
    logging:
      driver: 'json-file'
      options:
        max-size: '10m'
        max-file: '3'
```

### 8. Environment-Specific Configurations

Use multiple compose files:

```bash
# Base configuration
docker-compose.yml

# Production overrides
docker-compose.prod.yml

# Staging overrides
docker-compose.staging.yml

# Run with multiple files
docker-compose -f docker-compose.yml -f docker-compose.prod.yml up -d
```

### 9. Security Scanning

Scan images for vulnerabilities:

```bash
# Using Docker Scout
docker scout cves saas-ui-app:latest

# Using Trivy
trivy image saas-ui-app:latest
```

### 10. CI/CD Integration

Example GitHub Actions workflow:

```yaml
name: Build and Deploy

on:
  push:
    branches: [main]

jobs:
  build:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3

      - name: Set up Docker Buildx
        uses: docker/setup-buildx-action@v2

      - name: Login to Docker Hub
        uses: docker/login-action@v2
        with:
          username: ${{ secrets.DOCKER_USERNAME }}
          password: ${{ secrets.DOCKER_PASSWORD }}

      - name: Build and push
        uses: docker/build-push-action@v4
        with:
          context: .
          push: true
          tags: yourusername/saas-ui-app:latest
          cache-from: type=gha
          cache-to: type=gha,mode=max
```

## Troubleshooting

### Container Won't Start

**Check logs**:

```bash
docker-compose -f docker-compose.prod.yml logs app
```

**Common issues**:

- Missing environment variables
- Database connection failure
- Port already in use

### Database Connection Issues

**Test connection**:

```bash
docker-compose -f docker-compose.prod.yml exec database \
  psql -U postgres -d production
```

**Check network**:

```bash
docker network ls
docker network inspect saas-ui-pro-tanstack-start_app-network
```

### Build Failures

**Clear build cache**:

```bash
docker builder prune -a
```

**Rebuild without cache**:

```bash
docker-compose -f docker-compose.prod.yml build --no-cache
```

### Memory Issues

**Check container stats**:

```bash
docker stats
```

**Increase Docker memory limits** in Docker Desktop settings or system configuration.

### Permission Issues

**Ensure proper ownership**:

```bash
# Fix permissions on volumes
docker-compose -f docker-compose.prod.yml exec app chown -R appuser:nodejs /app
```

### Health Check Failing

**Implement health check endpoint** in [apps/web/src/routes/api/health.tsx](../apps/web/src/routes/api/health.tsx):

```typescript
export const Route = createFileRoute('/api/health')({
  server: {
    handlers: {
      GET: async () => {
        return new Response(
          JSON.stringify({ status: 'ok', timestamp: Date.now() }),
          {
            status: 200,
            headers: { 'Content-Type': 'application/json' },
          },
        )
      },
    },
  },
})
```

### Port Conflicts

**Change exposed ports** in docker-compose.prod.yml:

```yaml
ports:
  - '3001:3000' # Host:Container
```

### Debugging Inside Container

**Get shell access**:

```bash
docker-compose -f docker-compose.prod.yml exec app sh

# Or for database
docker-compose -f docker-compose.prod.yml exec database sh
```

## Monitoring & Maintenance

### Container Health Monitoring

Use Docker health checks or external tools:

- **Portainer** - Docker management UI
- **cAdvisor** - Container metrics
- **Prometheus + Grafana** - Metrics and visualization

### Log Aggregation

Consider centralized logging:

- **ELK Stack** (Elasticsearch, Logstash, Kibana)
- **Loki + Grafana**
- **CloudWatch** (AWS)

### Automated Backups

Set up automated database backups:

```bash
# Create backup script
cat > backup.sh << 'EOF'
#!/bin/bash
DATE=$(date +%Y%m%d_%H%M%S)
docker-compose -f docker-compose.prod.yml exec -T database \
  pg_dump -U postgres production | gzip > backups/backup_$DATE.sql.gz
find backups/ -mtime +7 -delete  # Keep 7 days
EOF

chmod +x backup.sh

# Add to crontab for daily backups
0 2 * * * /path/to/backup.sh
```

## Production Deployment Checklist

- [ ] Dockerfile created and tested
- [ ] .dockerignore configured
- [ ] docker-compose.prod.yml configured
- [ ] Production environment variables set
- [ ] Strong passwords generated for database
- [ ] SSL certificates obtained (if using Nginx)
- [ ] Health check endpoint implemented
- [ ] Build successful: `docker build -t saas-ui-app .`
- [ ] Containers start: `docker-compose -f docker-compose.prod.yml up -d`
- [ ] Database migrations run successfully
- [ ] Application accessible and functional
- [ ] Logs configured and accessible
- [ ] Backup strategy implemented
- [ ] Monitoring configured
- [ ] Resource limits set appropriately
- [ ] Security scan completed

## Additional Resources

- **Docker Documentation**: https://docs.docker.com
- **Docker Compose**: https://docs.docker.com/compose
- **PostgreSQL Docker**: https://hub.docker.com/_/postgres
- **Node.js Docker Best Practices**: https://github.com/nodejs/docker-node/blob/main/docs/BestPractices.md
