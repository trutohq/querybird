# QueryBird

Single-instance job scheduler that runs database queries or HTTP calls, transforms data with JSONata, and ships results to outputs (webhooks/HTTP/files/S3).

- 🐳 **Docker-first deployment** - Simple containerized deployment
- 🗄️ **Database Support**: PostgreSQL, MySQL
- ⏰ **Cron-based scheduling**
- 🔐 **Secrets management** with hot reloading
- ⚡ **Config hot reloading**
- 🔄 **Consistent CLI experience** across all environments

Full docs: see [DOCUMENTATION.md](DOCUMENTATION.md) and [DOCKER.md](DOCKER.md).

## 🚀 Quick Start

Get QueryBird running in 3 minutes:

```bash
# 1. Clone and build
git clone https://github.com/trutohq/querybird.git && cd querybird
docker-compose up -d

# 2. Setup your first job
docker-compose run --rm querybird-cli init-postgres

# 3. View logs
docker-compose logs -f querybird
```

**That's it!** 🎉 No complex installation, no system dependencies, no service configuration.

## Installation

### 🐳 Docker Deployment

**Prerequisites:** Docker and Docker Compose

**Quick Start:**
```bash
# Clone or download QueryBird
git clone https://github.com/trutohq/querybird.git
cd querybird

# Start with Docker Compose
docker-compose up -d

# Or build and run directly
docker build -t querybird:latest .
docker run -d --name querybird -v ~/.querybird:/app/.querybird --network host querybird:latest
```

**CLI Commands via Docker:**
```bash
# Use the wrapper script (copy to your PATH)
cp docker/querybird-wrapper.sh /usr/local/bin/querybird
chmod +x /usr/local/bin/querybird

# Now use exactly like before
querybird init-postgres
querybird run-once --job-id my-job
querybird start

# Or use Docker Compose directly
docker-compose run --rm querybird-cli init-postgres
docker-compose run --rm querybird-cli secrets wizard
```

**Why Docker-Only?**
- ✅ **Simplified deployment** - One command setup
- ✅ **No system dependencies** - Consistent runtime everywhere
- ✅ **Easy updates** - `docker-compose pull && docker-compose up -d`
- ✅ **Built-in monitoring** - Integrated logging and health checks
- ✅ **Cross-platform** - Same experience on any Docker host
- ✅ **Easier maintenance** - No native service management required

📚 **For complete Docker documentation, see [DOCKER.md](DOCKER.md)**

### 📂 External Secrets Configuration (Optional)

If you need to use external secrets files (e.g., shared across environments), configure a volume mount for easy access:

**1. Edit docker-compose.yml:**
```yaml
querybird-cli:
  # ... existing configuration
  volumes:
    - querybird_configs:/app/.querybird/configs
    - querybird_secrets:/app/.querybird/secrets
    - querybird_logs:/app/.querybird/logs
    - ./:/workspace
    - /path/to/your/secrets/directory:/external-secrets  # Add this line
```

**2. Use external secrets:**
```bash
# Now you can reference external secrets files easily
docker-compose run --rm querybird-cli config-postgres \
  --job-id prod-job \
  --secrets-file /external-secrets/production-secrets.json
```

**Benefits:**
- ✅ **One-time setup** - Configure once, use anywhere
- ✅ **Shared secrets** - Use same secrets across multiple environments
- ✅ **Version control** - Keep secrets files separate from application code
- ✅ **Easy management** - Direct file system access

---

## 🚀 Getting Started

After Docker setup, initialize PostgreSQL configuration:

```bash
# Using wrapper script
querybird init-postgres

# Or using Docker Compose
docker-compose run --rm querybird-cli init-postgres
```

This will interactively set up your database connection and create sample job configurations.

📚 **For database connection templates and examples, see [SECRETS.md](SECRETS.md)**

## 📋 Commands

All commands work via Docker using either the wrapper script or Docker Compose.

### Core Commands

#### `querybird start [options]`

Start the job scheduler and watch configs

**Options:**

- `--encryption-key <key>` - Encryption key for file-based secrets
- `--max-concurrent <num>` - Max concurrent jobs (default: 10)
- `--log-level <level>` - Log level: debug, info, warn, error (default: info)
- `--watch-secrets` - Enable hot reloading of secrets file (default: enabled)
- `--no-watch-secrets` - Disable hot reloading of secrets file

**Examples:**

```bash
# Using wrapper script
querybird start

# Docker Compose service (recommended)
docker-compose up -d

# Docker run directly  
docker run -d --name querybird -v ~/.querybird:/app/.querybird --network host querybird:latest

# Debug logging and custom concurrency
querybird start --log-level debug --max-concurrent 5

# Custom config directory
QB_CONFIG_DIR=/custom/path querybird start
```

#### `querybird run-once [options]`

Execute a single job once and exit

**Options:**

- `--job-id <id>` - Job ID to execute (required)
- `--encryption-key <key>` - Encryption key for file-based secrets
- `--log-level <level>` - Log level: debug, info, warn, error (default: info)

**Examples:**

```bash
# Using wrapper script
querybird run-once --job-id my-daily-export

# Docker Compose (recommended)
docker-compose run --rm querybird-cli run-once --job-id my-daily-export

# Docker run directly
docker run --rm -v ~/.querybird:/app/.querybird querybird:latest run-once --job-id my-daily-export

# Debug logging
querybird run-once --job-id my-job --log-level debug
```

#### `querybird update [action] [version]`

Check for updates or install new version

**Arguments:**

- `action` - Update action: `check` or `install`
- `version` - Specific version to install (optional)

**Examples:**

```bash
# Check for available updates
querybird update check

# Install latest version
querybird update install

# Install specific version
querybird update install v1.2.3
```

### Setup Commands

#### `querybird init-postgres [options]`

Interactive setup for PostgreSQL data extraction job

**Options:**

- `--encryption-key <key>` - Encryption key for file-based secrets

**What it does:**

- Prompts for job configuration (ID, name, schedule)
- Collects database connection details
- Sets up Balkan ID integration (optional)
- Generates config and secrets files

**Examples:**

```bash
# Using wrapper script
querybird init-postgres

# Docker Compose (recommended)
docker-compose run --rm querybird-cli init-postgres

# Docker run directly
docker run --rm -it -v ~/.querybird:/app/.querybird querybird:latest init-postgres
```

📚 **For detailed configuration examples and advanced setup, see [DOCUMENTATION.md](DOCUMENTATION.md#configuration)**

#### `querybird init-mysql [options]`

Interactive setup for MySQL data extraction job

**Options:**

- `--encryption-key <key>` - Encryption key for file-based secrets

**Example:**

```bash
querybird init-mysql
```

📚 **For detailed configuration examples and advanced setup, see [DOCUMENTATION.md](DOCUMENTATION.md#configuration)**

#### `querybird config-postgres [options]`

Generate PostgreSQL config from existing secrets

**Options:**

- `--job-id <id>` - Job ID (must match existing secrets key)
- `--encryption-key <key>` - Encryption key for file-based secrets
- `--secrets-file <path>` - Path to external secrets file to import from

**Examples:**

```bash
# Generate config from main secrets file
querybird config-postgres --job-id existing-job

# Using external secrets (requires volume mount setup - see External Secrets Configuration)
docker-compose run --rm querybird-cli config-postgres \
  --job-id prod-job \
  --secrets-file /external-secrets/production-secrets.json

# Or using wrapper script with local files
querybird config-postgres --job-id my-job --secrets-file ./local-secrets.json

📚 **For external secrets file templates and volume mount setup, see [SECRETS.md](SECRETS.md)**
```

#### `querybird config-mysql [options]`

Generate MySQL config from existing secrets

**Options:**

- `--job-id <id>` - Job ID (must match existing secrets key)
- `--encryption-key <key>` - Encryption key for file-based secrets
- `--secrets-file <path>` - Path to external secrets file to import from

**Examples:**

```bash
# Generate config from main secrets file
querybird config-mysql --job-id existing-job

# Using external secrets (requires volume mount setup - see External Secrets Configuration)
docker-compose run --rm querybird-cli config-mysql \
  --job-id prod-job \
  --secrets-file /external-secrets/production-secrets.json

# Or using wrapper script with local files
querybird config-mysql --job-id my-job --secrets-file ./local-secrets.json

📚 **For external secrets file templates and volume mount setup, see [SECRETS.md](SECRETS.md)**
```

### Secrets Management

#### `querybird secrets`

Manage encrypted secrets

**Sub-commands:**

- `wizard` - Interactive setup wizard for secrets
- `set` - Store a secret at the specified path
- `get` - Retrieve a secret value
- `list` - List all available secret paths
- `database` - Interactive database secrets setup
- `api-keys` - Interactive API keys setup
- `webhooks` - Interactive webhooks setup

**Examples:**

```bash
# Using wrapper script
querybird secrets wizard

# Docker Compose (recommended)
docker-compose run --rm querybird-cli secrets wizard

# Set a specific secret
querybird secrets set --path "myapp.api_key" --value "secret123"

# List all secret paths
querybird secrets list
```

📚 **For detailed secrets management documentation, templates, and examples, see [SECRETS.md](SECRETS.md)**

### Development Scripts

For contributors and advanced users, QueryBird includes npm scripts for Docker development:

```bash
# Development
npm run dev:docker          # Start development environment with hot reload
npm run dev:docker:logs     # View development logs

# Docker Management  
npm run docker:build        # Build production Docker image
npm run docker:start        # Start services with docker-compose
npm run docker:stop         # Stop all services
npm run docker:logs         # View service logs
npm run docker:cli          # Run CLI commands via docker-compose

# Cleanup
npm run clean:docker        # Clean up volumes and containers
```

### Environment Variables

- `QB_CONFIG_DIR` - Base directory for QueryBird files (default: `~/.querybird/` on host, `/app/.querybird` in container)

### Directory Structure

QueryBird uses the following directory structure:

```
~/.querybird/               # Base directory (configurable)
├── configs/               # Job configuration files (.yml, .yaml, .json)
├── secrets/               # Encrypted secrets storage
├── watermarks/            # Job execution tracking
├── outputs/               # Local file outputs
└── logs/                  # Application logs
```

### Hot Reloading

QueryBird supports hot reloading for both configuration and secrets files:

**Config Hot Reloading** (always enabled):

- Monitors `configs/` directory for `.yml`, `.yaml`, `.json` files
- Automatically reschedules jobs when configs change
- Handles file creation, modification, and deletion

**Secrets Hot Reloading** (enabled by default):

- Monitors `secrets/secrets.json` for changes
- Automatically reloads secrets when file is modified
- Closes existing database connections to force recreation with new credentials
- Validates secrets before applying changes (atomic reload)
- Can be disabled with `--no-watch-secrets` flag

📚 **For secrets management commands and examples, see [SECRETS.md](SECRETS.md)**

**Benefits:**

- No service restart required for config changes
- No service restart required for secrets updates (password changes, API key rotation)
- Graceful handling of connection pool updates

**Safety Features:**

- 500ms debounce to prevent excessive reloads during rapid file changes
- Atomic reload ensures secrets are validated before replacing cache
- Connection pool management prevents credential mismatch
- Error handling preserves service operation if reload fails

## Troubleshooting

### Docker Issues

**Common Docker troubleshooting:**

1. **Container won't start**:
   ```bash
   # Check container logs
   docker-compose logs querybird
   
   # Check if ports are available
   docker-compose ps
   ```

2. **Permission issues with volumes**:
   ```bash
   # Fix permissions for config directory
   mkdir -p ~/.querybird
   chmod -R 755 ~/.querybird
   ```

3. **Config or secrets not found**:
   ```bash
   # Verify volume mount
   docker-compose run --rm querybird-cli secrets list
   ```

4. **Service health check failing**:
   ```bash
   # Check health status
   docker-compose ps
   
   # View detailed logs
   docker-compose logs -f querybird
   ```

## 🏭 Production Deployment

QueryBird releases pre-built Docker images to GitHub Container Registry for easy production deployment.

### Quick Production Setup

**1. Download production docker-compose:**
```bash
curl -fsSL https://raw.githubusercontent.com/trutohq/querybird/main/docker-compose.production.yml > docker-compose.yml
```

**2. Start QueryBird:**
```bash
# Pull latest images and start
docker-compose pull
docker-compose up -d

# Verify it's running
docker-compose ps
```

**3. Setup your first job:**
```bash
# Interactive job setup
docker-compose run --rm querybird-cli init-postgres

# View logs
docker-compose logs -f querybird
```

### Docker Images

QueryBird publishes multi-architecture images (amd64/arm64) to GitHub Container Registry:

```bash
# Latest version
docker pull ghcr.io/trutohq/querybird:latest

# Specific version
docker pull ghcr.io/trutohq/querybird:v1.0.0

# Check available tags
curl -s https://api.github.com/repos/trutohq/querybird/packages
```

### Production Configuration

The production docker-compose includes:

- **✅ Persistent data storage** in `./querybird-data/`
- **✅ Health checks** for monitoring
- **✅ Restart policies** for reliability
- **✅ Optional PostgreSQL** for testing
- **✅ External secrets support** with volume mounts
- **✅ Production environment** settings

### Security Considerations

**🔒 Before production:**

1. **Change default passwords** in docker-compose.yml
2. **Configure firewall rules** to restrict access
3. **Use external secrets management** for sensitive data
4. **Set up SSL/TLS** if exposing endpoints
5. **Review volume permissions** and ownership
6. **Enable Docker security** features (AppArmor, SELinux)

### Monitoring & Maintenance

**📊 Monitoring:**
```bash
# View service status
docker-compose ps

# View logs
docker-compose logs -f querybird

# Check health status
docker inspect querybird --format='{{.State.Health.Status}}'
```

**🔧 Maintenance:**
```bash
# Backup data
tar -czf querybird-backup-$(date +%Y%m%d).tar.gz ./querybird-data/

# View disk usage
du -sh ./querybird-data/

# Clean old logs (if needed)
find ./querybird-data/logs/ -name "*.log" -mtime +30 -delete
```

## 🔄 Updating QueryBird

### Docker Updates (Preserves Config and Secrets)

**Update Command:**

```bash
# Pull latest images and restart
docker-compose pull
docker-compose up -d
```

**What the update preserves:**

- ✅ Existing configurations in `~/.querybird/configs/`
- ✅ Existing secrets in `~/.querybird/secrets/`
- ✅ All data in mounted volumes
- ✅ Container networking configuration

**Update Process:**

1. **Stop the current services**:
   ```bash
   docker-compose down
   ```

2. **Pull latest images**:
   ```bash
   docker-compose pull
   ```

3. **Start with new images**:
   ```bash
   docker-compose up -d
   ```

4. **Verify the update**:
   ```bash
   # Using wrapper script
   querybird --version
   
   # Or via docker-compose
   docker-compose run --rm querybird-cli --version
   ```

Docker updates are simple and safe, with automatic preservation of all configuration and data.

---

## Documentation

- 📖 [DOCUMENTATION.md](DOCUMENTATION.md) - Complete feature documentation
- 🔐 [SECRETS.md](SECRETS.md) - Secrets management guide with templates and examples
- 🐛 [Issues](https://github.com/trutohq/querybird/issues) - Bug reports and feature requests
- 📬 Security: eng@qtruto.one
