# RecursiveManager Docker Deployment Guide

This guide covers deploying RecursiveManager using Docker and Docker Compose.

## Table of Contents

- [Quick Start](#quick-start)
- [Prerequisites](#prerequisites)
- [Configuration](#configuration)
- [Building and Running](#building-and-running)
- [Volume Management](#volume-management)
- [Networking](#networking)
- [Health Checks](#health-checks)
- [Resource Limits](#resource-limits)
- [Troubleshooting](#troubleshooting)
- [Production Deployment](#production-deployment)

## Quick Start

```bash
# 1. Clone the repository
git clone <repository-url>
cd RecursiveManager

# 2. Create environment configuration
cp .env.docker .env
# Edit .env with your API keys and configuration

# 3. Create data and logs directories
mkdir -p data logs

# 4. Build and start the container
docker-compose up -d

# 5. Check container status
docker-compose ps

# 6. View logs
docker-compose logs -f recursive-manager

# 7. Run CLI commands
docker-compose exec recursive-manager node packages/cli/dist/cli.js --help
```

## Prerequisites

- **Docker**: Version 20.10 or higher
- **Docker Compose**: Version 2.0 or higher (or `docker compose` plugin)
- **System Requirements**:
  - 512MB RAM minimum (2GB recommended)
  - 1GB disk space minimum (more for data storage)
  - Linux, macOS, or Windows with WSL2

### Installation

**Ubuntu/Debian**:
```bash
curl -fsSL https://get.docker.com -o get-docker.sh
sh get-docker.sh
sudo apt-get install docker-compose-plugin
```

**macOS**:
```bash
brew install docker docker-compose
```

**Windows**: Install [Docker Desktop](https://www.docker.com/products/docker-desktop/)

## Configuration

### Environment Variables

RecursiveManager uses environment variables for configuration. Create a `.env` file from the template:

```bash
cp .env.docker .env
```

Edit `.env` and configure the following sections:

#### Required Configuration

```env
# AI Provider (choose one)
AI_PROVIDER=aiceo-gateway  # or anthropic-direct, openai-direct

# AICEO Gateway (if using)
AICEO_GATEWAY_URL=http://host.docker.internal:4000/api/glm/submit
AICEO_GATEWAY_API_KEY=your-shared-secret

# OR Direct Anthropic
ANTHROPIC_API_KEY=sk-ant-...

# OR Direct OpenAI
OPENAI_API_KEY=sk-...
```

#### Optional Configuration

```env
# Database Encryption (recommended for production)
DATABASE_ENCRYPTION_KEY=your-secure-password
DATABASE_ENCRYPTION_USE_KDF=true

# Secret Management (recommended for production)
SECRET_ENCRYPTION_KEY=your-64-char-hex-key
SECRET_ENCRYPTION_USE_KDF=false

# Logging
LOG_LEVEL=info  # debug, info, warn, error

# Resource Configuration
MAX_AGENT_DEPTH=5
MAX_AGENTS_PER_MANAGER=10
WORKER_POOL_SIZE=5
```

See `.env.docker` for complete configuration options.

## Building and Running

### Using Docker Compose (Recommended)

```bash
# Build and start in detached mode
docker-compose up -d

# Start with build (force rebuild)
docker-compose up -d --build

# View logs
docker-compose logs -f

# Stop containers
docker-compose down

# Stop and remove volumes (WARNING: deletes all data)
docker-compose down -v
```

### Using Docker Directly

```bash
# Build the image
docker build -t recursive-manager:latest .

# Run the container
docker run -d \
  --name recursive-manager \
  --env-file .env \
  -v $(pwd)/data:/app/data \
  -v $(pwd)/logs:/app/logs \
  -p 3000:3000 \
  recursive-manager:latest

# View logs
docker logs -f recursive-manager

# Stop the container
docker stop recursive-manager
docker rm recursive-manager
```

## Volume Management

RecursiveManager uses named volumes for data persistence:

### Volume Structure

```
./data/               # Application data
  ├── agents.db       # Agent configurations
  ├── snapshots/      # System snapshots
  └── *.db            # Other databases

./logs/               # Application logs
  └── recursive-manager.log
```

### Backing Up Data

```bash
# Create a backup archive
docker-compose exec recursive-manager tar czf /tmp/backup.tar.gz /app/data
docker cp recursive-manager:/tmp/backup.tar.gz ./backup-$(date +%Y%m%d).tar.gz

# Or use the built-in snapshot feature
docker-compose exec recursive-manager \
  node packages/cli/dist/cli.js rollback --create-snapshot
```

### Restoring Data

```bash
# Stop the container
docker-compose down

# Extract backup to data directory
tar xzf backup-20260120.tar.gz -C ./data

# Start the container
docker-compose up -d
```

### Changing Volume Locations

Edit `.env` to change volume paths:

```env
DATA_VOLUME_PATH=/path/to/your/data
LOGS_VOLUME_PATH=/path/to/your/logs
```

## Networking

### Container Networking

The `docker-compose.yml` creates a bridge network (`recursive-manager-network`) with subnet `172.28.0.0/16`.

### Accessing External Services

- **Host services**: Use `host.docker.internal` (macOS/Windows) or `172.17.0.1` (Linux)
- **Other containers**: Use service name as hostname (e.g., `http://aiceo-gateway:4000`)

Example `.env` configuration for gateway on host:

```env
# macOS/Windows
AICEO_GATEWAY_URL=http://host.docker.internal:4000/api/glm/submit

# Linux
AICEO_GATEWAY_URL=http://172.17.0.1:4000/api/glm/submit
```

### Port Mapping

By default, port 3000 is exposed (for future API server). Change in `.env`:

```env
PORT=8080  # Maps to 8080:3000
```

## Health Checks

The container includes a health check that runs every 30 seconds:

```bash
# Check container health status
docker-compose ps

# View health check logs
docker inspect --format='{{json .State.Health}}' recursive-manager | jq
```

Health check tests:
- Node.js runtime is working
- Container is responsive

## Resource Limits

Default resource limits (defined in `docker-compose.yml`):

```yaml
resources:
  limits:
    cpus: '2.0'      # Maximum 2 CPU cores
    memory: 2G       # Maximum 2GB RAM
  reservations:
    cpus: '0.5'      # Reserve 0.5 CPU cores
    memory: 512M     # Reserve 512MB RAM
```

### Adjusting Resource Limits

Edit `docker-compose.yml` to change limits:

```yaml
deploy:
  resources:
    limits:
      cpus: '4.0'
      memory: 4G
    reservations:
      cpus: '1.0'
      memory: 1G
```

### Monitoring Resource Usage

```bash
# View real-time stats
docker stats recursive-manager

# View stats in JSON format
docker stats --no-stream --format "{{json .}}" recursive-manager
```

## Running CLI Commands

Execute CLI commands inside the container:

```bash
# Interactive shell
docker-compose exec recursive-manager sh

# Run a specific command
docker-compose exec recursive-manager \
  node packages/cli/dist/cli.js status

# Run with custom arguments
docker-compose exec recursive-manager \
  node packages/cli/dist/cli.js analyze "Should we implement feature X?"

# Create an alias for convenience
alias ralph="docker-compose exec recursive-manager node packages/cli/dist/cli.js"
ralph status
```

## Troubleshooting

### Container Won't Start

```bash
# Check logs for errors
docker-compose logs recursive-manager

# Check container status
docker-compose ps

# Inspect container configuration
docker inspect recursive-manager
```

### Permission Errors

The container runs as non-root user `recursive` (UID 1001). Ensure volume directories have correct permissions:

```bash
# Fix permissions
sudo chown -R 1001:1001 ./data ./logs

# Or make world-writable (less secure)
chmod 777 ./data ./logs
```

### Database Locked Errors

SQLite databases can be locked if accessed by multiple processes:

```bash
# Stop all containers
docker-compose down

# Remove stale locks
rm -f ./data/*.db-shm ./data/*.db-wal

# Restart
docker-compose up -d
```

### Out of Memory

If the container is killed due to OOM:

```bash
# Increase memory limit in docker-compose.yml
memory: 4G  # Instead of 2G

# Check current memory usage
docker stats recursive-manager
```

### Network Connectivity Issues

```bash
# Test connectivity from inside container
docker-compose exec recursive-manager ping -c 3 8.8.8.8

# Check DNS resolution
docker-compose exec recursive-manager nslookup google.com

# Test API endpoint connectivity
docker-compose exec recursive-manager wget -O- http://host.docker.internal:4000/health
```

### Rebuild After Code Changes

```bash
# Rebuild and restart
docker-compose up -d --build

# Force clean rebuild
docker-compose build --no-cache
docker-compose up -d
```

## Production Deployment

### Security Best Practices

1. **Use Secrets Management**: Don't store API keys in `.env` files in production
2. **Enable Encryption**: Always enable database and secret encryption
3. **Resource Limits**: Set appropriate CPU/memory limits
4. **Health Checks**: Monitor container health
5. **Regular Backups**: Automate data backups
6. **Update Base Images**: Keep Node.js and Alpine images up to date

### Production docker-compose.yml

```yaml
services:
  recursive-manager:
    image: recursive-manager:1.0.0  # Use specific version tags
    restart: unless-stopped

    # Use Docker secrets instead of env vars
    secrets:
      - anthropic_api_key
      - database_encryption_key

    # Production environment
    environment:
      NODE_ENV: production
      LOG_LEVEL: warn  # Reduce logging in production

    # Bind to localhost only
    ports:
      - "127.0.0.1:3000:3000"

    # Stricter resource limits
    deploy:
      resources:
        limits:
          cpus: '2.0'
          memory: 2G

    # Logging driver
    logging:
      driver: "json-file"
      options:
        max-size: "10m"
        max-file: "3"

secrets:
  anthropic_api_key:
    external: true
  database_encryption_key:
    external: true
```

### Automated Backups

Create a backup cron job:

```bash
#!/bin/bash
# /etc/cron.daily/recursive-manager-backup

BACKUP_DIR=/backups/recursive-manager
DATE=$(date +%Y%m%d-%H%M%S)

docker-compose exec -T recursive-manager \
  tar czf - /app/data | \
  cat > $BACKUP_DIR/backup-$DATE.tar.gz

# Keep only last 7 days
find $BACKUP_DIR -name "backup-*.tar.gz" -mtime +7 -delete
```

### Monitoring Integration

Add Prometheus metrics export (Phase 9):

```yaml
services:
  recursive-manager:
    # ... existing config ...
    ports:
      - "3000:3000"   # API
      - "9090:9090"   # Metrics

  prometheus:
    image: prom/prometheus:latest
    volumes:
      - ./monitoring/prometheus.yml:/etc/prometheus/prometheus.yml
    ports:
      - "9091:9090"
```

### Reverse Proxy Setup

Use Nginx or Caddy as a reverse proxy:

```nginx
# /etc/nginx/sites-available/recursive-manager
server {
    listen 80;
    server_name recursive-manager.example.com;

    location / {
        proxy_pass http://localhost:3000;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
    }
}
```

### High Availability Setup

For HA deployments, use Docker Swarm or Kubernetes (see `docs/DEPLOYMENT.md` for advanced scenarios).

## Additional Resources

- [Docker Documentation](https://docs.docker.com/)
- [Docker Compose Documentation](https://docs.docker.com/compose/)
- [RecursiveManager Configuration Guide](./docs/CONFIGURATION.md)
- [RecursiveManager Security Guide](./docs/SECURITY.md)
- [RecursiveManager Deployment Guide](./docs/DEPLOYMENT.md)

## Support

For issues and questions:
- GitHub Issues: <repository-url>/issues
- Documentation: `./docs/`
- Examples: `./examples/`
