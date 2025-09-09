# QueryBird Docker Setup

QueryBird now supports containerized deployment with Docker, eliminating the complexity of systemd services and providing a consistent cross-platform experience.

## Quick Start

### 1. Build and Run
```bash
# Build the image
docker build -t querybird:latest .

# Run with Docker Compose (recommended)
docker-compose up -d

# Or run directly
docker run -d --name querybird \
  -v ~/.querybird:/app/.querybird \
  --network host \
  querybird:latest
```

### 2. CLI Commands via Docker
```bash
# Use the wrapper script (copy to your PATH)
cp docker/querybird-wrapper.sh /usr/local/bin/querybird
chmod +x /usr/local/bin/querybird

# Now use exactly like before
querybird init-postgres
querybird run-once --job-id my-job
querybird start
```

### 3. Docker Compose CLI
```bash
# Run CLI commands
docker-compose run --rm querybird-cli init-postgres
docker-compose run --rm querybird-cli secrets:wizard
docker-compose run --rm querybird-cli run-once --job-id my-job

# View logs
docker-compose logs -f querybird
```

## External Secrets Configuration

QueryBird supports using external secrets files that are stored outside the container. This is useful for:
- Sharing secrets across multiple environments
- Keeping secrets separate from application code
- Version controlling secrets independently

### Setup External Secrets Volume

**1. Edit your `docker-compose.yml` file:**

```yaml
services:
  querybird-cli:
    build:
      context: .
      dockerfile: Dockerfile
    profiles: ["cli"]
    environment:
      - QB_CONFIG_DIR=/app/.querybird
    volumes:
      - querybird_configs:/app/.querybird/configs
      - querybird_secrets:/app/.querybird/secrets
      - querybird_logs:/app/.querybird/logs
      - ./:/workspace
      # Add your external secrets directory
      - /path/to/your/secrets/directory:/external-secrets
    networks:
      - querybird-network
    working_dir: /workspace
    entrypoint: ["bun", "run", "dist/main-runner.js"]
```

**2. Create your external secrets directory:**

```bash
# Create a directory for your external secrets
mkdir -p /opt/querybird-secrets

# Create environment-specific secrets
cat > /opt/querybird-secrets/production.json << 'EOF'
{
  "prod-users": {
    "database": {
      "primary": {
        "host": "prod-db.company.com",
        "port": 5432,
        "database": "users",
        "username": "readonly",
        "password": "secure-password"
      }
    },
    "webhooks": {
      "webhook_url": "https://api.company.com/webhook/users"
    }
  }
}
EOF

cat > /opt/querybird-secrets/staging.json << 'EOF'
{
  "staging-users": {
    "database": {
      "primary": {
        "host": "staging-db.company.com",
        "port": 5432,
        "database": "users",
        "username": "readonly",
        "password": "staging-password"
      }
    }
  }
}
EOF
```

**3. Update your docker-compose.yml with the actual path:**

```yaml
volumes:
  - /opt/querybird-secrets:/external-secrets
```

### Using External Secrets

Once configured, you can use external secrets files with the config commands:

```bash
# Generate config for production
docker-compose run --rm querybird-cli config-postgres \
  --job-id prod-users \
  --secrets-file /external-secrets/production.json

# Generate config for staging
docker-compose run --rm querybird-cli config-postgres \
  --job-id staging-users \
  --secrets-file /external-secrets/staging.json
```

### Benefits

- ✅ **One-time setup** - Configure volume mount once, use everywhere
- ✅ **Environment separation** - Keep prod/staging/dev secrets separate
- ✅ **Version control** - Track secrets changes independently
- ✅ **Security** - External secrets can have different permissions
- ✅ **Backup & restore** - Easier to backup secret files separately

## Development

### Hot Reload Development
```bash
# Start development environment with hot reload
npm run dev:docker

# View logs
npm run dev:docker:logs

# Access databases
# PostgreSQL Primary: localhost:5432
# PostgreSQL Staging: localhost:5433  
# MySQL: localhost:3306
# pgAdmin: http://localhost:8081
```

### Available Scripts
```bash
npm run docker:build      # Build production image
npm run docker:start      # Start services
npm run docker:stop       # Stop services
npm run docker:logs       # View logs
npm run docker:cli        # Run CLI commands
npm run clean:docker      # Clean up volumes and containers
```

## Configuration

### Volume Mounts
- **Configs**: `~/.querybird/configs` → `/app/.querybird/configs`
- **Secrets**: `~/.querybird/secrets` → `/app/.querybird/secrets`
- **Logs**: `~/.querybird/logs` → `/app/.querybird/logs`

### Environment Variables
- `QB_CONFIG_DIR`: Configuration base directory (default: `/app/.querybird`)
- `LOG_LEVEL`: Logging level (`debug`, `info`, `warn`, `error`)
- `NODE_ENV`: Environment (`development`, `production`)

## Deployment Options

### 1. Docker Compose (Recommended)
```bash
# Production deployment
docker-compose up -d

# With custom configuration
QB_CONFIG_DIR=/custom/path docker-compose up -d
```

### 2. Docker Run
```bash
# Basic deployment
docker run -d \
  --name querybird \
  --restart unless-stopped \
  -v ~/.querybird:/app/.querybird \
  --network host \
  querybird:latest

# With environment overrides
docker run -d \
  --name querybird \
  --restart unless-stopped \
  -v ~/.querybird:/app/.querybird \
  -e LOG_LEVEL=debug \
  -e NODE_ENV=production \
  --network host \
  querybird:latest
```

### 3. Docker Swarm / Kubernetes
The Docker images are ready for orchestration platforms. See the included `docker-compose.yml` as a starting point.

## Networking

### Host Network Mode (Default)
Uses `--network host` for direct database access on `localhost:5432`, `localhost:5433`, etc.

### Bridge Network
For isolated networking:
```yaml
services:
  querybird:
    networks:
      - querybird-network
    # Connect to databases via service names
    
networks:
  querybird-network:
    driver: bridge
```

## Health Checks

QueryBird includes built-in health checks:
```bash
# Manual health check
docker exec querybird bun run dist/main-runner.js health

# Docker health status
docker ps  # Shows health status
```

## Migration from SystemD

### Before (SystemD)
```bash
# Complex installation
curl -fsSL install.sh | bash
sudo systemctl enable querybird
sudo systemctl start querybird

# Updates require reinstallation
```

### After (Docker)
```bash
# Simple deployment
docker-compose up -d

# Updates are just image pulls
docker-compose pull && docker-compose up -d
```

## Troubleshooting

### Common Issues

**1. Permission Issues**
```bash
# Fix volume permissions
sudo chown -R $(id -u):$(id -g) ~/.querybird
```

**2. Port Conflicts**
```bash
# Check what's using ports
ss -tlnp | grep :5432
```

**3. Database Connection Issues**
```bash
# Test database connectivity
docker-compose run --rm querybird-cli \
  bun run dist/main-runner.js health
```

### Logs
```bash
# Container logs
docker-compose logs querybird

# Application logs
docker-compose exec querybird tail -f .querybird/logs/querybird.log
```

### Debug Mode
```bash
# Run with debug logging
LOG_LEVEL=debug docker-compose up
```

## Benefits of Docker Approach

- ✅ **No systemd complexity** - Docker handles process management
- ✅ **Consistent environment** - Same runtime everywhere
- ✅ **Easy updates** - `docker-compose pull && up -d`
- ✅ **Better monitoring** - Built-in Docker logging and health checks
- ✅ **Simpler CI/CD** - Standard Docker build pipeline
- ✅ **Cross-platform** - Runs on any Docker host
- ✅ **Isolation** - No system pollution or conflicts

## 🚀 Release Process (For Maintainers)

QueryBird uses GitHub Container Registry for Docker image distribution.

### Automated Releases

The release process is fully automated:

1. **Version bump** - Update `version` in `package.json`
2. **Push to main** - Triggers GitHub Action workflow
3. **Auto-release** - Builds and publishes Docker images to `ghcr.io/trutohq/querybird`

### Release Workflow

```yaml
# Triggered by:
- Push to main (with package.json version change)
- Manual workflow dispatch
- GitHub release events

# Publishes:
- ghcr.io/trutohq/querybird:latest
- ghcr.io/trutohq/querybird:v1.0.0
- Multi-architecture: linux/amd64, linux/arm64
```

### Manual Release

```bash
# Trigger manual release
gh workflow run docker-release.yml --field version=1.0.0

# Or via GitHub UI
# Actions -> Docker Release -> Run workflow
```

### Image Tags

- `latest` - Latest stable release (main branch)
- `vX.Y.Z` - Specific version tags
- `vX.Y` - Minor version tags  
- `vX` - Major version tags

### For Users

Users get releases via:

```bash
# Download production docker-compose
curl -fsSL https://raw.githubusercontent.com/trutohq/querybird/main/docker-compose.production.yml > docker-compose.yml

# Start latest version
docker-compose pull && docker-compose up -d
```

## Need Help?

- Check logs: `docker-compose logs querybird`
- Health check: `docker exec querybird querybird health`
- GitHub Issues: https://github.com/trutohq/querybird/issues