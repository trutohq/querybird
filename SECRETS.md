# QueryBird Secrets Management

This guide covers secrets management in QueryBird, including templates, commands, and best practices for production use.

## Table of Contents

- [Overview](#overview)
- [Secrets Templates](#secrets-templates)
- [Management Commands](#management-commands)
- [External Secrets Import](#external-secrets-import)
- [Best Practices](#best-practices)
- [Troubleshooting](#troubleshooting)

## Overview

QueryBird uses encrypted secrets to store sensitive information like database credentials, API keys, and webhook URLs. Secrets are managed through command-line tools and can be imported from external files.

### Secrets File Location
- **Production**: `./querybird-data/secrets/secrets.json`
- **Development**: `./test-data/secrets/secrets.json`

## Secrets Templates

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
    },
    "api_keys": {
      "balkan_integration_id": "your_integration_id"
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
    },
    "api_keys": {
      "balkan_integration_id": "your_integration_id"
    }
  }
}
```

### Multi-Environment Template
```json
{
  "production-job": {
    "database": {
      "primary": {
        "host": "prod-db.company.com",
        "port": 5432,
        "database": "prod_app",
        "user": "prod_user",
        "password": "prod_password",
        "region": "us-east-1",
        "ssl": true,
        "timeout": 30000
      }
    },
    "webhooks": {
      "webhook_url": "https://api.company.com/webhook/prod"
    }
  },
  "staging-job": {
    "database": {
      "primary": {
        "host": "staging-db.company.com",
        "port": 5432,
        "database": "staging_app",
        "user": "staging_user",
        "password": "staging_password",
        "region": "us-west-1",
        "ssl": true,
        "timeout": 30000
      }
    },
    "webhooks": {
      "webhook_url": "https://api.company.com/webhook/staging"
    }
  }
}
```

## Management Commands

### Interactive Setup
```bash
# Full interactive wizard
docker-compose run --rm querybird-cli secrets wizard

# Setup specific secret types
docker-compose run --rm querybird-cli secrets database
docker-compose run --rm querybird-cli secrets api-keys
docker-compose run --rm querybird-cli secrets webhooks
```

### Manual Secrets Management

#### Setting Secrets
```bash
# Set database host
docker-compose run --rm querybird-cli secrets set \
  --path "job.database.primary.host" \
  --value "new-db-host.com"

# Set database password
docker-compose run --rm querybird-cli secrets set \
  --path "job.database.primary.password" \
  --value "new_secure_password"

# Set webhook URL
docker-compose run --rm querybird-cli secrets set \
  --path "job.webhooks.webhook_url" \
  --value "https://new-webhook.com/endpoint"

# Set API key
docker-compose run --rm querybird-cli secrets set \
  --path "job.api_keys.balkan_integration_id" \
  --value "new_integration_123"
```

#### Getting Secrets
```bash
# Get database host
docker-compose run --rm querybird-cli secrets get \
  --path "job.database.primary.host"

# Get all database configurations
docker-compose run --rm querybird-cli secrets get \
  --path "job.database"

# Get webhook URL
docker-compose run --rm querybird-cli secrets get \
  --path "job.webhooks.webhook_url"
```

#### Listing Secrets
```bash
# List all secret paths
docker-compose run --rm querybird-cli secrets list

# List paths for specific job
docker-compose run --rm querybird-cli secrets list | grep "job-name"
```

### Updating Existing Secrets

#### Database Credentials
```bash
# Update database password after rotation
docker-compose run --rm querybird-cli secrets set \
  --path "job.database.primary.password" \
  --value "rotated_password_789"

# Update database host after migration
docker-compose run --rm querybird-cli secrets set \
  --path "job.database.primary.host" \
  --value "new-primary.example.com"

# Update connection timeout
docker-compose run --rm querybird-cli secrets set \
  --path "job.database.primary.timeout" \
  --value "45000"
```

#### API Keys and Webhooks
```bash
# Update webhook endpoint
docker-compose run --rm querybird-cli secrets set \
  --path "job.webhooks.webhook_url" \
  --value "https://api.company.com/v2/webhooks"

# Update integration ID
docker-compose run --rm querybird-cli secrets set \
  --path "job.api_keys.balkan_integration_id" \
  --value "updated_integration_456"
```

### Batch Secret Updates
```bash
#!/bin/bash
# Update all production database passwords

NEW_PASSWORD="new_secure_password_123"

docker-compose run --rm querybird-cli secrets set \
  --path "job1.database.primary.password" \
  --value "$NEW_PASSWORD"

docker-compose run --rm querybird-cli secrets set \
  --path "job2.database.primary.password" \
  --value "$NEW_PASSWORD"

docker-compose run --rm querybird-cli secrets set \
  --path "job3.database.primary.password" \
  --value "$NEW_PASSWORD"

echo "✅ Updated passwords for all production databases"
```

## External Secrets Import

### Step 1: Create External Secrets File
Create a JSON file with your database configurations using the templates above.

**Example `production-secrets.json`:**
```json
{
  "production-users": {
    "database": {
      "primary": {
        "host": "prod-db.company.com",
        "port": 5432,
        "database": "users_db",
        "user": "readonly_user",
        "password": "secure_password_123",
        "region": "us-east-1",
        "ssl": true,
        "timeout": 30000
      }
    },
    "webhooks": {
      "webhook_url": "https://api.company.com/webhook/users"
    }
  }
}
```

### Step 2: Import and Generate Config
```bash
# For PostgreSQL
docker-compose run --rm querybird-cli config-postgres \
  --job-id production-users \
  --secrets-file /workspace/production-secrets.json

# For MySQL
docker-compose run --rm querybird-cli config-mysql \
  --job-id mysql-job \
  --secrets-file /workspace/mysql-secrets.json
```

### Step 3: Complete the Setup
The command will:
1. ✅ Import your database configurations
2. ✅ Import your webhook URLs and API keys
3. ❓ Ask for job name, description, and schedule
4. ✅ Generate the complete job configuration
5. ✅ Save everything to QueryBird

### Important Notes
- **External files are not modified** - data is copied to QueryBird
- **Only job-specific data** is imported (databases, webhooks, API keys)
- **Global settings** remain in QueryBird's main secrets file

## Best Practices

### Security
1. **Use strong passwords** for database connections
2. **Enable SSL** for database connections when possible
3. **Rotate credentials** regularly
4. **Use environment-specific secrets** files
5. **Restrict file permissions** on secrets files

### Organization
1. **Use descriptive job IDs** that indicate purpose and environment
2. **Group related secrets** under the same job ID
3. **Use consistent naming** for database connections
4. **Document secret purposes** in comments or documentation

### File Management
1. **Keep secrets files separate** from application code
2. **Use version control** for secrets templates (without actual credentials)
3. **Backup secrets files** regularly
4. **Use different files** for different environments

### Example Production Setup
```bash
# Create environment-specific secrets directories
mkdir -p /opt/querybird-secrets/{production,staging,development}

# Set proper permissions
chmod 700 /opt/querybird-secrets
chmod 600 /opt/querybird-secrets/*/*.json

# Create production secrets
cat > /opt/querybird-secrets/production/database.json << 'EOF'
{
  "prod-users": {
    "database": {
      "primary": {
        "host": "prod-db.company.com",
        "port": 5432,
        "database": "users",
        "user": "querybird_reader",
        "password": "secure_prod_password",
        "region": "us-east-1",
        "ssl": true,
        "timeout": 30000
      }
    },
    "webhooks": {
      "webhook_url": "https://api.company.com/webhook/users"
    }
  }
}
EOF

# Update docker-compose.yml to mount secrets directory
# volumes:
#   - /opt/querybird-secrets:/external-secrets
```

## Troubleshooting

### Common Issues

#### 1. "No secrets found for job ID"
```bash
# Check if job ID exists
docker-compose run --rm querybird-cli secrets list | grep "job-id"

# Verify secrets file location
ls -la ./querybird-data/secrets/secrets.json

# Check file permissions
ls -la ./querybird-data/secrets/
```

#### 2. "Database connection failed"
```bash
# Verify database credentials
docker-compose run --rm querybird-cli secrets get --path "job.database.primary.host"
docker-compose run --rm querybird-cli secrets get --path "job.database.primary.password"

# Test database connectivity
docker-compose run --rm querybird-cli health

# Check network connectivity
docker-compose run --rm querybird-cli ping your-db-host.com
```

#### 3. "Secrets not reloading"
```bash
# Check if hot reloading is enabled
docker-compose logs querybird | grep "watch-secrets"

# Verify secrets file permissions
ls -la ./querybird-data/secrets/secrets.json

# Check QueryBird logs for file watching errors
docker-compose logs querybird | grep "secrets"
```

#### 4. "External secrets file not found"
```bash
# Verify file exists and is accessible
ls -la /workspace/your-secrets.json

# Check volume mount in docker-compose.yml
docker-compose config | grep -A 10 "volumes:"

# Test file access from container
docker-compose run --rm querybird-cli ls -la /workspace/
```

### Debug Commands
```bash
# Check secrets file content
docker-compose run --rm querybird-cli cat /app/.querybird/secrets/secrets.json

# Verify job configuration
docker-compose run --rm querybird-cli cat /app/.querybird/configs/job-name.yml

# Test database connection
docker-compose run --rm querybird-cli run-once --job-id job-name --log-level debug
```

### Getting Help
- Check the main [README.md](README.md) for quick start guide
- Review [DOCUMENTATION.md](DOCUMENTATION.md) for complete feature documentation
- Use `docker-compose run --rm querybird-cli --help` for command-line help
- Use `docker-compose run --rm querybird-cli secrets --help` for secrets-specific help