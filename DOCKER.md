# QueryBird Docker Deployment

This guide covers Docker deployment options for QueryBird, including production setup, development environment, and advanced configurations.

## Table of Contents

- [Quick Start](#quick-start)
- [Production Deployment](#production-deployment)
- [Development Environment](#development-environment)
- [External Secrets Configuration](#external-secrets-configuration)
- [Docker Images](#docker-images)
- [Troubleshooting](#troubleshooting)

## Quick Start

### Production Setup
```bash
# 1. Download production configuration
curl -fsSL https://raw.githubusercontent.com/trutohq/querybird/main/docker-compose.production.yml > docker-compose.yml

# 2. Start QueryBird
docker-compose up -d

# 3. Verify it's running
docker-compose ps
```

### Development Setup
```bash
# 1. Clone repository
git clone https://github.com/trutohq/querybird.git
cd querybird

# 2. Start development environment
docker-compose -f docker-compose.test.yml up -d

# 3. View logs
docker-compose logs -f querybird
```

## Production Deployment

### Using Pre-built Images
```bash
# Download production docker-compose
curl -fsSL https://raw.githubusercontent.com/trutohq/querybird/main/docker-compose.production.yml > docker-compose.yml

# Start QueryBird
docker-compose up -d

# Verify deployment
docker-compose ps
```

### Custom Configuration
```yaml
# docker-compose.yml
services:
  querybird:
    image: ghcr.io/trutohq/querybird:latest
    container_name: querybird
    restart: unless-stopped
    environment:
      - NODE_ENV=production
      - LOG_LEVEL=info
      - QB_CONFIG_DIR=/app/.querybird
    volumes:
      - ./querybird-data/configs:/app/.querybird/configs
      - ./querybird-data/secrets:/app/.querybird/secrets
      - ./querybird-data/watermarks:/app/.querybird/watermarks
      - ./querybird-data/outputs:/app/.querybird/outputs
      - ./querybird-data/logs:/app/.querybird/logs
    networks:
      - querybird-network
    healthcheck:
      test: ['CMD', 'bun', 'run', 'dist/main-runner.js', 'health']
      interval: 30s
      timeout: 10s
      retries: 3
      start_period: 10s

  querybird-cli:
    image: ghcr.io/trutohq/querybird:latest
    profiles: ['cli']
    environment:
      - QB_CONFIG_DIR=/app/.querybird
    volumes:
      - ./querybird-data/configs:/app/.querybird/configs
      - ./querybird-data/secrets:/app/.querybird/secrets
      - ./querybird-data/watermarks:/app/.querybird/watermarks
      - ./querybird-data/outputs:/app/.querybird/outputs
      - ./querybird-data/logs:/app/.querybird/logs
      - ./:/workspace
    networks:
      - querybird-network
    working_dir: /workspace
    entrypoint: ['bun', 'run', 'dist/main-runner.js']

networks:
  querybird-network:
    driver: bridge
```

### CLI Commands
```bash
# Run job once
docker-compose run --rm querybird-cli run-once --job-id my-job

# Generate PostgreSQL config
docker-compose run --rm querybird-cli config-postgres \
  --job-id my-job \
  --secrets-file /workspace/secrets.json

# Interactive setup
docker-compose run --rm querybird-cli init-postgres

# Health check
docker-compose run --rm querybird-cli health
```

## Development Environment

### Test Environment
The development environment includes test databases and management tools:

```bash
# Start development environment
docker-compose -f docker-compose.test.yml up -d

# Available services:
# - QueryBird: Main application
# - PostgreSQL Primary: Test database (port 5432)
# - PostgreSQL Staging: Test database (port 5433)
# - MySQL: Test database (port 3306)
# - pgAdmin: Database management (port 8080)
# - phpMyAdmin: MySQL management (port 8081)
```

### Development Commands
```bash
# View logs
docker-compose logs -f querybird

# Run tests
docker-compose run --rm querybird-cli test

# Access databases
# PostgreSQL Primary: localhost:5432
# PostgreSQL Staging: localhost:5433
# MySQL: localhost:3306
# pgAdmin: http://localhost:8080
# phpMyAdmin: http://localhost:8081
```

### Available Scripts
```bash
# Development
npm run dev:docker          # Start development environment
npm run dev:docker:logs     # View development logs

# Docker Management
npm run docker:build        # Build production image
npm run docker:start        # Start services
npm run docker:stop         # Stop services
npm run docker:logs         # View service logs
npm run docker:cli          # Run CLI commands
npm run clean:docker        # Clean up volumes and containers
```

## External Secrets Configuration

### Setup External Secrets Volume
```yaml
# docker-compose.yml
services:
  querybird-cli:
    # ... existing configuration
    volumes:
      - ./querybird-data/configs:/app/.querybird/configs
      - ./querybird-data/secrets:/app/.querybird/secrets
      - ./querybird-data/watermarks:/app/.querybird/watermarks
      - ./querybird-data/outputs:/app/.querybird/outputs
      - ./querybird-data/logs:/app/.querybird/logs
      - ./:/workspace
      # Add external secrets directory
      - /path/to/your/secrets/directory:/external-secrets
```

### Using External Secrets
```bash
# Create external secrets directory
mkdir -p /opt/querybird-secrets

# Create production secrets
cat > /opt/querybird-secrets/production.json << 'EOF'
{
  "prod-users": {
    "database": {
      "primary": {
        "host": "prod-db.company.com",
        "port": 5432,
        "database": "users",
        "user": "readonly",
        "password": "secure-password"
      }
    },
    "webhooks": {
      "webhook_url": "https://api.company.com/webhook/users"
    }
  }
}
EOF

# Update docker-compose.yml
# volumes:
#   - /opt/querybird-secrets:/external-secrets

# Use external secrets
docker-compose run --rm querybird-cli config-postgres \
  --job-id prod-users \
  --secrets-file /external-secrets/production.json
```

### Benefits
- ✅ **One-time setup** - Configure volume mount once, use everywhere
- ✅ **Environment separation** - Keep prod/staging/dev secrets separate
- ✅ **Version control** - Track secrets changes independently
- ✅ **Security** - External secrets can have different permissions
- ✅ **Backup & restore** - Easier to backup secret files separately

## Docker Images

### Available Images
QueryBird publishes multi-architecture images to GitHub Container Registry:

```bash
# Latest version
docker pull ghcr.io/trutohq/querybird:latest

# Specific version
docker pull ghcr.io/trutohq/querybird:v1.0.0

# Check available tags
curl -s https://api.github.com/repos/trutohq/querybird/packages
```

### Image Tags
- `latest` - Latest stable release (main branch)
- `vX.Y.Z` - Specific version tags
- `vX.Y` - Minor version tags
- `vX` - Major version tags

### Multi-Architecture Support
Images are built for:
- `linux/amd64` - Intel/AMD 64-bit
- `linux/arm64` - ARM 64-bit (Apple Silicon, ARM servers)

### Building from Source
```bash
# Build production image
docker build -t querybird:latest .

# Build with specific tag
docker build -t querybird:v1.0.0 .

# Build for specific architecture
docker buildx build --platform linux/amd64 -t querybird:latest .
```

## Troubleshooting

### Common Issues

#### 1. Container Won't Start
```bash
# Check container logs
docker-compose logs querybird

# Check container status
docker-compose ps

# Check if ports are available
netstat -tlnp | grep :8080
```

#### 2. Permission Issues
```bash
# Fix volume permissions
sudo chown -R $(id -u):$(id -g) ./querybird-data/

# Fix specific file permissions
chmod 644 ./querybird-data/secrets/secrets.json
chmod 644 ./querybird-data/configs/*.yml
```

#### 3. Database Connection Issues
```bash
# Test database connectivity
docker-compose run --rm querybird-cli health

# Check database credentials
docker-compose run --rm querybird-cli secrets get --path "job.database.host"

# Test network connectivity
docker-compose run --rm querybird-cli ping your-db-host.com
```

#### 4. Secrets Not Found
```bash
# Verify secrets file exists
ls -la ./querybird-data/secrets/secrets.json

# List available secrets
docker-compose run --rm querybird-cli secrets list

# Check file permissions
ls -la ./querybird-data/secrets/
```

### Debug Mode
```bash
# Run with debug logging
docker-compose run --rm querybird-cli start --log-level debug

# Run job with debug logging
docker-compose run --rm querybird-cli run-once --job-id job-name --log-level debug
```

### Health Checks
```bash
# Check container health
docker inspect querybird --format='{{.State.Health.Status}}'

# Manual health check
docker-compose run --rm querybird-cli health

# Check database connections
docker-compose run --rm querybird-cli secrets list
```

### Logs
```bash
# View all logs
docker-compose logs querybird

# Follow logs in real-time
docker-compose logs -f querybird

# View specific log level
docker-compose logs querybird | grep "ERROR"

# View job-specific logs
docker-compose logs querybird | grep "job-name"
```

### Cleanup
```bash
# Stop and remove containers
docker-compose down

# Remove volumes (WARNING: This will delete all data)
docker-compose down -v

# Remove images
docker rmi ghcr.io/trutohq/querybird:latest

# Clean up everything
docker system prune -a
```

## Benefits of Docker Approach

- ✅ **No systemd complexity** - Docker handles process management
- ✅ **Consistent environment** - Same runtime everywhere
- ✅ **Easy updates** - `docker-compose pull && up -d`
- ✅ **Better monitoring** - Built-in Docker logging and health checks
- ✅ **Simpler CI/CD** - Standard Docker build pipeline
- ✅ **Cross-platform** - Runs on any Docker host
- ✅ **Isolation** - No system pollution or conflicts
- ✅ **Scalability** - Easy to scale with orchestration platforms

## Need Help?

- Check logs: `docker-compose logs querybird`
- Health check: `docker-compose run --rm querybird-cli health`
- GitHub Issues: https://github.com/trutohq/querybird/issues