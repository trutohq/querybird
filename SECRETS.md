# QueryBird Secrets Management

This document explains how to manage secrets in QueryBird, including templates, examples, and commands for updating secrets.

## Table of Contents

- [Overview](#overview)
- [Templates](#templates)
- [Examples](#examples)
- [Management Commands](#management-commands)
- [External Secrets Import](#external-secrets-import)
- [Best Practices](#best-practices)

## Overview

QueryBird uses encrypted secrets to store sensitive information like database credentials, API keys, and webhook URLs. The secrets are managed through command-line tools and can be imported from external files.

## External Secrets File Templates

These are the files you create to import database configurations into QueryBird.

### PostgreSQL Template

```json
{
  "your-job-id": {
    "database": {
      "production": {
        "host": "prod.example.com",
        "port": 5432,
        "database": "prod_app",
        "user": "prod_user",
        "password": "prod_password",
        "region": "us-east-1",
        "ssl": true,
        "timeout": 30000
      },
      "staging": {
        "host": "staging.example.com",
        "port": 5432,
        "database": "staging_app",
        "user": "staging_user",
        "password": "staging_password",
        "region": "us-west-1",
        "ssl": true,
        "timeout": 30000
      }
    },
    "api_keys": {
      "balkan_integration_id": "your_integration_id"
    }
  }
}
```

**Note**: The `api_keys` section is optional. If you don't include it, the command will prompt you for the integration ID.

### MySQL Template

For MySQL databases:

```json
{
  "mysql-job": {
    "database": {
      "mysql-primary": {
        "host": "mysql.example.com",
        "port": 3306,
        "database": "mysql_database",
        "user": "mysql_user",
        "password": "mysql_password",
        "region": "us-east-1",
        "ssl": true,
        "timeout": 30000
      }
    },
    "api_keys": {
      "balkan_integration_id": "your_integration_id"
    }
  }
}
```

**Note**: The `api_keys` section is optional. If you don't include it, the command will prompt you for the integration ID.

## Management Commands

### Interactive Secrets Setup

```bash
# Full interactive wizard
querybird secrets wizard

# Setup specific secret types
querybird secrets database
querybird secrets api-keys
querybird secrets webhooks
```

### Manual Secrets Management

#### Setting Secrets
```bash
# Set database host
querybird secrets set --path "daily-sync.database.primary.host" --value "new-db-host.com"

# Set database password
querybird secrets set --path "daily-sync.database.primary.password" --value "new_secure_password"

# Set Balkan integration ID
querybird secrets set --path "daily-sync.api_keys.balkan_integration_id" --value "new_integration_123"

# Set webhook URL
querybird secrets set --path "daily-sync.webhooks.webhook_url" --value "https://new-webhook.com/endpoint"

# Set global Balkan API key
querybird secrets set --path "balkan.balkan_key_id" --value "bk_live_new_key_123"
querybird secrets set --path "balkan.balkan_key_secret" --value "bks_live_new_secret_456"
```

#### Getting Secrets
```bash
# Get database host
querybird secrets get --path "daily-sync.database.primary.host"

# Get all database configurations for a job
querybird secrets get --path "daily-sync.database"

# Get integration ID
querybird secrets get --path "daily-sync.api_keys.balkan_integration_id"
```

#### Listing Secrets
```bash
# List all secret paths
querybird secrets list

# List paths for specific job
querybird secrets list | grep "daily-sync"
```

### Updating Existing Secrets

#### Update Database Credentials
```bash
# Update database password after rotation
querybird secrets set --path "user-export.database.production.password" --value "rotated_password_789"

# Update database host after migration
querybird secrets set --path "user-export.database.production.host" --value "new-primary.example.com"

# Update connection timeout
querybird secrets set --path "user-export.database.production.timeout" --value "45000"
```

#### Update API Keys
```bash
# Update integration ID for specific job
querybird secrets set --path "audit-job.api_keys.balkan_integration_id" --value "updated_integration_456"

# Update global Balkan credentials
querybird secrets set --path "balkan.balkan_key_id" --value "bk_live_updated_key"
querybird secrets set --path "balkan.balkan_key_secret" --value "bks_live_updated_secret"
```

#### Update Webhook URLs
```bash
# Update webhook endpoint
querybird secrets set --path "notification-job.webhooks.webhook_url" --value "https://api.company.com/v2/webhooks"

# Add new webhook for existing job
querybird secrets set --path "data-sync.webhooks.backup_webhook" --value "https://backup.company.com/webhook"
```

### Batch Secret Updates

For multiple updates, you can use shell scripts:

```bash
#!/bin/bash
# Update all production database passwords

querybird secrets set --path "job1.database.primary.password" --value "$NEW_PASSWORD"
querybird secrets set --path "job2.database.primary.password" --value "$NEW_PASSWORD"
querybird secrets set --path "job3.database.primary.password" --value "$NEW_PASSWORD"

echo "✅ Updated passwords for all production databases"
```

### Generate Config from Secrets

```bash
# Generate PostgreSQL config from existing secrets
querybird config-postgres --job-id your-job-id

# Generate from external secrets file
querybird config-postgres --job-id external-job --secrets-file /path/to/external-secrets.json

# Generate MySQL config
querybird config-mysql --job-id mysql-job
```

## Using External Secrets Files

### Step 1: Create Your Secrets File

Create a JSON file with your database configurations (use templates above).

Example `client-database.json`:
```json
{
  "client-export": {
    "database": {
      "client-prod": {
        "host": "client-db.example.com",
        "port": 5432,
        "database": "client_app",
        "user": "readonly_user",
        "password": "secure_password_123",
        "region": "us-east-1",
        "ssl": true,
        "timeout": 30000
      }
    },
    "api_keys": {
      "balkan_integration_id": "client_integration_789"
    }
  }
}
```

### Step 2: Import and Generate Config

```bash
# For PostgreSQL
querybird config-postgres --job-id client-export --secrets-file client-database.json

# For MySQL  
querybird config-mysql --job-id mysql-job --secrets-file mysql-secrets.json
```

### Step 3: Complete the Setup

The command will:
1. ✅ Import your database configurations
2. ✅ Import your integration ID (if included in external file)
3. ❓ Ask for job name, description, and schedule
4. ❓ Ask for integration ID (if not included in external file)
5. ✅ Generate the complete job configuration
6. ✅ Save everything to QueryBird

### Important Notes

- **Global Balkan API keys** are never imported from external files (they stay in QueryBird's main secrets)
- **Only job-specific data** is imported (databases and integration IDs)  
- **External files are not modified** - data is copied to QueryBird


### Database Connection Settings

#### PostgreSQL Recommended Settings
```json
{
  "host": "postgres.example.com",
  "port": 5432,
  "database": "your_database",
  "user": "querybird_reader",
  "password": "secure_password",
  "region": "us-east-1",
  "ssl": true,
  "timeout": 30000
}
```

#### MySQL Recommended Settings
```json
{
  "host": "mysql.example.com",
  "port": 3306,
  "database": "your_database",
  "user": "querybird_reader",
  "password": "secure_password",
  "region": "us-east-1",
  "ssl": true,
  "timeout": 30000
}
```
## Troubleshooting

### Common Issues

1. **"No secrets found for job ID"**
   - Ensure the job ID exists in secrets.json
   - Check that the secrets file is in the correct location
   - Verify the QB_CONFIG_DIR environment variable

2. **"Database connection failed"**
   - Verify host, port, and credentials
   - Check SSL requirements
   - Ensure network connectivity
   - Verify timeout settings

3. **"Balkan integration ID missing"**
   - Add the integration ID to `api_keys.balkan_integration_id`
   - Ensure global Balkan keys are set in the `balkan` section

4. **Secrets not reloading**
   - Check if `--watch-secrets` is enabled (default: enabled)
   - Verify the secrets file permissions
   - Check QueryBird logs for file watching errors

### Getting Help

- Check the main [README.md](README.md) for general information
- Review [DOCUMENTATION.md](DOCUMENTATION.md) for complete feature documentation
- Use `querybird --help` for command-line help
- Use `querybird secrets --help` for secrets-specific help