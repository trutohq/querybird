# QueryBird

Single-instance job scheduler that runs database queries or HTTP calls, transforms data with JSONata, and ships results to outputs (webhooks/HTTP/files/S3).

- 🐳 **Docker-first deployment** - Simple containerized deployment
- 🗄️ **Database Support**: PostgreSQL, MySQL
- ⏰ **Cron-based scheduling**
- 🔐 **Secrets management** with hot reloading
- ⚡ **Config hot reloading**
- 🔄 **Consistent CLI experience** across all environments

## 🚀 Quick Start

Get QueryBird running in production in 3 steps:

### 1. Download Production Setup

```bash
# Download production docker-compose
curl -fsSL https://raw.githubusercontent.com/trutohq/querybird/main/docker-compose.production.yml > docker-compose.yml

# Start QueryBird
docker-compose up -d
```

### 2. Create Secrets Template

```bash
# Create your secrets file
cat > production-secrets.json << 'EOF'
{
  "my-database-job": {
    "database": {
      "primary": {
        "host": "your-db-host.com",
        "port": 5432,
        "database": "your_database",
        "user": "your_username",
        "password": "your_password",
        "region": "us-east-1",
        "ssl": true,
        "timeout": 30000
      }
    },
    "webhooks": {
      "webhook_url": "https://your-webhook-endpoint.com"
    }
  }
}
EOF
```

### 3. Generate Job Configuration

```bash
# Generate PostgreSQL job from external secrets
docker-compose run --rm querybird-cli config-postgres \
  --job-id my-database-job \
  --secrets-file /workspace/production-secrets.json

# Or generate MySQL job
docker-compose run --rm querybird-cli config-mysql \
  --job-id my-database-job \
  --secrets-file /workspace/production-secrets.json
```

**That's it!** 🎉 Your job is now running and will execute on the schedule you specified.

## 📋 Production Commands

### Core Commands

#### Start QueryBird

```bash
# Start the scheduler
docker-compose up -d

# View logs
docker-compose logs -f querybird
```

#### Run Job Once

```bash
# Execute a job manually
docker-compose run --rm querybird-cli run-once --job-id my-database-job
```

#### Health Check

```bash
# Check if QueryBird is healthy
docker-compose run --rm querybird-cli health
```

### Configuration Commands

#### Generate PostgreSQL Job

```bash
# From external secrets file
docker-compose run --rm querybird-cli config-postgres \
  --job-id your-job-id \
  --secrets-file /workspace/your-secrets.json

# From existing secrets
docker-compose run --rm querybird-cli config-postgres --job-id existing-job
```

#### Generate MySQL Job

```bash
# From external secrets file
docker-compose run --rm querybird-cli config-mysql \
  --job-id your-job-id \
  --secrets-file /workspace/your-secrets.json

# From existing secrets
docker-compose run --rm querybird-cli config-mysql --job-id existing-job
```

#### Interactive Setup

```bash
# Interactive PostgreSQL setup
docker-compose run --rm querybird-cli init-postgres

# Interactive MySQL setup
docker-compose run --rm querybird-cli init-mysql
```

### Secrets Management

```bash
# Interactive secrets wizard
docker-compose run --rm querybird-cli secrets wizard

# Set specific secrets
docker-compose run --rm querybird-cli secrets set --path "job.database.host" --value "new-host.com"

# List all secrets
docker-compose run --rm querybird-cli secrets list
```

## 🔧 Secrets Templates

### PostgreSQL Template

```json
{
  "your-job-id": {
    "database": {
      "primary": {
        "host": "your-db-host.com",
        "port": 5432,
        "database": "your_database",
        "user": "your_username",
        "password": "your_password",
        "region": "us-east-1",
        "ssl": true,
        "timeout": 30000
      },
      "staging": {
        "host": "staging-db-host.com",
        "port": 5432,
        "database": "staging_database",
        "user": "staging_username",
        "password": "staging_password",
        "region": "us-west-1",
        "ssl": true,
        "timeout": 30000
      }
    },
    "webhooks": {
      "webhook_url": "https://your-webhook-endpoint.com"
    }
  }
}
```

### MySQL Template

```json
{
  "mysql-job-id": {
    "database": {
      "primary": {
        "host": "mysql-host.com",
        "port": 3306,
        "database": "your_database",
        "user": "your_username",
        "password": "your_password",
        "region": "us-east-1",
        "ssl": true,
        "timeout": 30000
      }
    },
    "webhooks": {
      "webhook_url": "https://your-webhook-endpoint.com"
    }
  }
}
```

## 🏭 Production Deployment

### Docker Images

QueryBird publishes pre-built images to GitHub Container Registry:

```bash
# Latest version
docker pull ghcr.io/trutohq/querybird:latest

# Specific version
docker pull ghcr.io/trutohq/querybird:v1.0.0
```

### Production Configuration

The production setup includes:

- ✅ **Persistent data storage** in `./querybird-data/`
- ✅ **Health checks** for monitoring
- ✅ **Restart policies** for reliability
- ✅ **External secrets support** with volume mounts
- ✅ **Production environment** settings

### Security Considerations

**🔒 Before production:**

1. **Change default passwords** in your secrets files
2. **Configure firewall rules** to restrict access
3. **Use external secrets management** for sensitive data
4. **Set up SSL/TLS** if exposing endpoints
5. **Review volume permissions** and ownership

### Monitoring & Maintenance

```bash
# View service status
docker-compose ps

# View logs
docker-compose logs -f querybird

# Backup data
tar -czf querybird-backup-$(date +%Y%m%d).tar.gz ./querybird-data/

# Update to latest version
docker-compose pull && docker-compose up -d
```

## 📁 Directory Structure

QueryBird uses the following directory structure:

```
./querybird-data/              # Production data directory
├── configs/                   # Job configuration files (.yml, .yaml, .json)
├── secrets/                   # Encrypted secrets storage
├── watermarks/                # Job execution tracking
├── outputs/                   # Local file outputs
└── logs/                      # Application logs
```

## 🔄 Hot Reloading

QueryBird supports hot reloading for both configuration and secrets files:

- **Config Hot Reloading** (always enabled): Monitors `configs/` directory for changes
- **Secrets Hot Reloading** (enabled by default): Monitors `secrets/secrets.json` for changes

No service restart required for config or secrets updates!

## 🆘 Troubleshooting

### Common Issues

**1. Container won't start:**

```bash
# Check container logs
docker-compose logs querybird

# Check if ports are available
docker-compose ps
```

**2. Permission issues:**

```bash
# Fix permissions for data directory
sudo chown -R $(id -u):$(id -g) ./querybird-data/
```

**3. Database connection failed:**

```bash
# Test database connectivity
docker-compose run --rm querybird-cli health
```

**4. Secrets not found:**

```bash
# Verify secrets file exists
ls -la ./querybird-data/secrets/

# List available secrets
docker-compose run --rm querybird-cli secrets list
```

## 📚 Documentation

- 📖 [DOCUMENTATION.md](DOCUMENTATION.md) - Complete feature documentation and advanced usage
- 🔐 [SECRETS.md](SECRETS.md) - Detailed secrets management guide with templates
- 🐛 [Issues](https://github.com/trutohq/querybird/issues) - Bug reports and feature requests
- 📬 Security: eng@qtruto.one

## License

MIT – see [LICENSE](LICENSE)
