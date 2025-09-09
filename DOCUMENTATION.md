# QueryBird Complete Documentation

## Table of Contents

- [Overview](#overview)
- [Installation & Setup](#installation--setup)
- [Configuration](#configuration)
- [Commands Reference](#commands-reference)
- [Data Transformation](#data-transformation)
- [Outputs](#outputs)
- [Scheduling](#scheduling)
- [Secrets Management](#secrets-management)
- [Development](#development)
- [Troubleshooting](#troubleshooting)

## Overview

QueryBird is a single-instance job scheduler that can execute database queries, HTTP requests, and transform the results using JSONata. It's designed for production use with Docker-first deployment.

### Key Features

- **Database Support**: PostgreSQL and MySQL connections
- **HTTP Integration**: Make HTTP requests and process responses
- **JSONata Transformations**: Powerful data transformation using JSONata expressions
- **Flexible Scheduling**: Cron-based job scheduling
- **Multiple Outputs**: Webhooks, HTTP endpoints, files, and S3
- **Secrets Management**: Secure handling of connection strings and API keys
- **Hot Reloading**: Configuration and secrets reload without restart
- **Docker-First**: Containerized deployment for consistency

## Installation & Setup

### Production Setup

#### 1. Download Production Configuration

```bash
# Download production docker-compose
curl -fsSL https://raw.githubusercontent.com/trutohq/querybird/main/docker-compose.production.yml > docker-compose.yml
```

#### 2. Start QueryBird

```bash
# Start the service
docker-compose up -d

# Verify it's running
docker-compose ps
```

#### 3. Create Your First Job

```bash
# Interactive setup
docker-compose run --rm querybird-cli init-postgres

# Or from external secrets file
docker-compose run --rm querybird-cli config-postgres \
  --job-id my-job \
  --secrets-file /workspace/my-secrets.json
```

### Development Setup

#### Using Docker Compose

```bash
# Clone the repository
git clone https://github.com/trutohq/querybird.git
cd querybird

# Start development environment
docker-compose -f docker-compose.test.yml up -d

# View logs
docker-compose logs -f querybird
```

#### Available Services

- **QueryBird**: Main application (port 8080)
- **PostgreSQL Primary**: Test database (port 5432)
- **PostgreSQL Staging**: Test database (port 5433)
- **MySQL**: Test database (port 3306)
- **pgAdmin**: Database management (port 8080)
- **phpMyAdmin**: MySQL management (port 8081)

## Configuration

### Job Configuration Structure

QueryBird jobs are defined in YAML files in the `configs/` directory:

```yaml
id: my-database-job
name: 'Daily User Export'
description: 'Export user data from production database'
schedule: '0 2 * * *' # Daily at 2 AM
enabled: true

input:
  postgres:
    - name: production
      connection_info: '!secrets my-database-job.database.production'
      sql:
        - name: users
          sql: 'SELECT id, name, email, created_at FROM users WHERE active = true'
        - name: orders
          sql: 'SELECT user_id, order_id, amount, created_at FROM orders WHERE created_at >= $watermark'
    - name: staging
      connection_info: '!secrets my-database-job.database.staging'
      sql:
        - name: users
          sql: 'SELECT id, name, email, created_at FROM users WHERE active = true'

transform: |-
  {
    "production_users": production.users,
    "staging_users": staging.users,
    "user_count": $count(production.users),
    "total_orders": $sum(production.orders.amount)
  }

outputs:
  - type: webhook
    endpoint: '!secrets my-database-job.webhooks.webhook_url'
    method: POST
    headers:
      Content-Type: application/json
      X-QueryBird-Job: my-database-job
    retryCount: 3
    timeout: 30000

watermark:
  enabled: true
  column: 'created_at'
  table: 'users'
  database: 'production'
```

### Database Input Configuration

#### PostgreSQL

```yaml
input:
  postgres:
    - name: production
      connection_info: '!secrets job.database.production'
      sql:
        - name: table_name
          sql: "SELECT * FROM table_name WHERE condition = 'value'"
        - name: another_table
          sql: 'SELECT id, name FROM another_table'
```

#### MySQL

```yaml
input:
  mysql:
    - name: production
      connection_info: '!secrets job.database.production'
      sql:
        - name: table_name
          sql: "SELECT * FROM table_name WHERE condition = 'value'"
```

#### HTTP Input

```yaml
input:
  http:
    - name: api_data
      url: 'https://api.example.com/data'
      method: GET
      headers:
        Authorization: 'Bearer !secrets job.api_keys.token'
      timeout: 30000
```

### Watermark Configuration

Watermarks track the last processed record to enable incremental data processing:

```yaml
watermark:
  enabled: true
  column: 'created_at' # Column to track
  table: 'users' # Table name
  database: 'production' # Database name (from input)
  initial_value: '2024-01-01T00:00:00Z' # Optional initial value
```

## Commands Reference

### Core Commands

#### `start [options]`

Start the job scheduler and watch configs

**Options:**

- `--encryption-key <key>` - Encryption key for file-based secrets
- `--max-concurrent <num>` - Max concurrent jobs (default: 10)
- `--log-level <level>` - Log level: debug, info, warn, error (default: info)
- `--watch-secrets` - Enable hot reloading of secrets file (default: enabled)
- `--no-watch-secrets` - Disable hot reloading of secrets file

**Examples:**

```bash
# Start with default settings
docker-compose up -d

# Start with debug logging
docker-compose run --rm querybird-cli start --log-level debug

# Start with custom concurrency
docker-compose run --rm querybird-cli start --max-concurrent 5
```

#### `run-once [options]`

Execute a single job once and exit

**Options:**

- `--job-id <id>` - Job ID to execute (required)
- `--encryption-key <key>` - Encryption key for file-based secrets
- `--log-level <level>` - Log level: debug, info, warn, error (default: info)

**Examples:**

```bash
# Run a specific job
docker-compose run --rm querybird-cli run-once --job-id my-database-job

# Run with debug logging
docker-compose run --rm querybird-cli run-once --job-id my-database-job --log-level debug
```

#### `health`

Check if QueryBird is healthy

**Examples:**

```bash
# Check health status
docker-compose run --rm querybird-cli health
```

### Setup Commands

#### `init-postgres [options]`

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
# Interactive PostgreSQL setup
docker-compose run --rm querybird-cli init-postgres
```

#### `init-mysql [options]`

Interactive setup for MySQL data extraction job

**Options:**

- `--encryption-key <key>` - Encryption key for file-based secrets

**Examples:**

```bash
# Interactive MySQL setup
docker-compose run --rm querybird-cli init-mysql
```

#### `config-postgres [options]`

Generate PostgreSQL config from existing secrets

**Options:**

- `--job-id <id>` - Job ID (must match existing secrets key)
- `--encryption-key <key>` - Encryption key for file-based secrets
- `--secrets-file <path>` - Path to external secrets file to import from

**Examples:**

```bash
# Generate from existing secrets
docker-compose run --rm querybird-cli config-postgres --job-id existing-job

# Generate from external secrets file
docker-compose run --rm querybird-cli config-postgres \
  --job-id prod-job \
  --secrets-file /workspace/production-secrets.json
```

#### `config-mysql [options]`

Generate MySQL config from existing secrets

**Options:**

- `--job-id <id>` - Job ID (must match existing secrets key)
- `--encryption-key <key>` - Encryption key for file-based secrets
- `--secrets-file <path>` - Path to external secrets file to import from

**Examples:**

```bash
# Generate from existing secrets
docker-compose run --rm querybird-cli config-mysql --job-id existing-job

# Generate from external secrets file
docker-compose run --rm querybird-cli config-mysql \
  --job-id mysql-job \
  --secrets-file /workspace/mysql-secrets.json
```

### Secrets Management

#### `secrets wizard`

Interactive setup wizard for secrets

**Examples:**

```bash
# Full interactive wizard
docker-compose run --rm querybird-cli secrets wizard
```

#### `secrets set --path <path> --value <value>`

Store a secret at the specified path

**Examples:**

```bash
# Set database host
docker-compose run --rm querybird-cli secrets set \
  --path "job.database.host" \
  --value "new-db-host.com"

# Set database password
docker-compose run --rm querybird-cli secrets set \
  --path "job.database.password" \
  --value "new_secure_password"
```

#### `secrets get --path <path>`

Retrieve a secret value

**Examples:**

```bash
# Get database host
docker-compose run --rm querybird-cli secrets get --path "job.database.host"

# Get all database configurations
docker-compose run --rm querybird-cli secrets get --path "job.database"
```

#### `secrets list`

List all available secret paths

**Examples:**

```bash
# List all secrets
docker-compose run --rm querybird-cli secrets list

# List secrets for specific job
docker-compose run --rm querybird-cli secrets list | grep "my-job"
```

### Update Commands

#### `update [action] [version]`

Check for updates or install new version

**Arguments:**

- `action` - Update action: `check` or `install`
- `version` - Specific version to install (optional)

**Examples:**

```bash
# Check for available updates
docker-compose run --rm querybird-cli update check

# Install latest version
docker-compose run --rm querybird-cli update install

# Install specific version
docker-compose run --rm querybird-cli update install v1.2.3
```

## Data Transformation

QueryBird uses JSONata for data transformation, providing powerful data manipulation capabilities.

### Database Result Structure

QueryBird provides a structured data context for JSONata transformations:

```json
{
  "production": {
    "users": [
      {"id": 1, "name": "John", "email": "john@example.com"},
      {"id": 2, "name": "Jane", "email": "jane@example.com"}
    ],
    "orders": [
      {"user_id": 1, "order_id": "ORD-001", "amount": 100.50},
      {"user_id": 2, "order_id": "ORD-002", "amount": 75.25}
    ],
    "connection_info": {
      "db_name": "production_db",
      "region": "us-east-1",
      "host": "prod-db.example.com",
      "port": 5432,
      "user": "querybird_user",
      "ssl": true
    }
  },
  "staging": {
    "users": [...],
    "connection_info": {...}
  },
  "connections_info": {
    "production": {...},
    "staging": {...}
  }
}
```

### JSONata Examples

#### Basic Data Access

```jsonata
{
  "user_count": $count(production.users),
  "total_orders": $sum(production.orders.amount),
  "active_users": production.users[active = true]
}
```

#### Data Filtering and Transformation

```jsonata
production.users.{
  "user_id": id,
  "full_name": name,
  "email_domain": $substringAfter(email, "@"),
  "order_count": $count(production.orders[user_id = id]),
  "total_spent": $sum(production.orders[user_id = id].amount)
}
```

#### Cross-Database Operations

```jsonata
{
  "production_users": production.users,
  "staging_users": staging.users,
  "all_users": $merge([production.users, staging.users]),
  "user_differences": $setDiff(production.users, staging.users)
}
```

#### Using Connection Info

```jsonata
{
  "database_name": production.connection_info.db_name,
  "region": production.connection_info.region,
  "users_with_context": production.users.{
    "user_id": id,
    "database": production.connection_info.db_name,
    "region": production.connection_info.region
  }
}
```

#### Advanced Transformations

```jsonata
{
  "user_summary": production.users.{
    "user_id": id,
    "name": name,
    "email": email,
    "orders": production.orders[user_id = id],
    "total_spent": $sum(production.orders[user_id = id].amount),
    "last_order": $max(production.orders[user_id = id].created_at)
  },
  "top_customers": $sort(production.users.{
    "user_id": id,
    "name": name,
    "total_spent": $sum(production.orders[user_id = id].amount)
  }, function($l, $r) { $l.total_spent > $r.total_spent })[0..4]
}
```

## Outputs

QueryBird supports multiple output types for sending processed data.

### Webhook Output

```yaml
outputs:
  - type: webhook
    endpoint: '!secrets job.webhooks.webhook_url'
    method: POST
    headers:
      Content-Type: application/json
      Authorization: 'Bearer !secrets job.api_keys.token'
    retryCount: 3
    timeout: 30000
```

### HTTP Output

```yaml
outputs:
  - type: http
    url: 'https://api.example.com/data'
    method: POST
    headers:
      Content-Type: application/json
      X-API-Key: '!secrets job.api_keys.api_key'
    retryCount: 2
    timeout: 30000
```

### File Output

```yaml
outputs:
  - type: file
    path: '/app/.querybird/outputs/job-results.json'
    format: json
    append: false
```

### S3 Output

```yaml
outputs:
  - type: s3
    bucket: 'my-bucket'
    key: 'data/job-results-{timestamp}.json'
    region: 'us-east-1'
    accessKeyId: '!secrets job.aws.access_key_id'
    secretAccessKey: '!secrets job.aws.secret_access_key'
    format: json
```

## Scheduling

QueryBird uses cron expressions for job scheduling.

### Cron Format

```
* * * * *
│ │ │ │ │
│ │ │ │ └─── Day of week (0-7, 0 or 7 is Sunday)
│ │ │ └───── Month (1-12)
│ │ └─────── Day of month (1-31)
│ └───────── Hour (0-23)
└─────────── Minute (0-59)
```

### Common Schedules

```yaml
# Every minute
schedule: "* * * * *"

# Every hour at minute 0
schedule: "0 * * * *"

# Daily at 2 AM
schedule: "0 2 * * *"

# Every Monday at 9 AM
schedule: "0 9 * * 1"

# Every 15 minutes
schedule: "*/15 * * * *"

# Every weekday at 6 PM
schedule: "0 18 * * 1-5"
```

## Secrets Management

### Secrets File Structure

```json
{
  "job-id": {
    "database": {
      "primary": {
        "host": "db.example.com",
        "port": 5432,
        "database": "my_database",
        "user": "my_user",
        "password": "my_password",
        "region": "us-east-1",
        "ssl": true,
        "timeout": 30000
      }
    },
    "api_keys": {
      "balkan_integration_id": "integration_123"
    },
    "webhooks": {
      "webhook_url": "https://webhook.example.com/endpoint"
    }
  }
}
```

### External Secrets Import

```bash
# Import from external file
docker-compose run --rm querybird-cli config-postgres \
  --job-id my-job \
  --secrets-file /workspace/external-secrets.json
```

### Secrets Hot Reloading

Secrets are automatically reloaded when the `secrets/secrets.json` file changes, without requiring a service restart.

## Development

### Development Environment

```bash
# Start development environment
docker-compose -f docker-compose.test.yml up -d

# View logs
docker-compose logs -f querybird

# Run tests
docker-compose run --rm querybird-cli test
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

### Building from Source

```bash
# Build production image
docker build -t querybird:latest .

# Build with specific tag
docker build -t querybird:v1.0.0 .
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

#### 2. Database Connection Failed

```bash
# Test database connectivity
docker-compose run --rm querybird-cli health

# Check database credentials
docker-compose run --rm querybird-cli secrets get --path "job.database.host"
```

#### 3. Secrets Not Found

```bash
# Verify secrets file exists
ls -la ./querybird-data/secrets/

# List available secrets
docker-compose run --rm querybird-cli secrets list

# Check secrets file permissions
ls -la ./querybird-data/secrets/secrets.json
```

#### 4. Job Not Running

```bash
# Check job configuration
cat ./querybird-data/configs/job-name.yml

# Check job status
docker-compose logs querybird | grep "job-name"

# Run job manually
docker-compose run --rm querybird-cli run-once --job-id job-name
```

#### 5. Permission Issues

```bash
# Fix permissions for data directory
sudo chown -R $(id -u):$(id -g) ./querybird-data/

# Fix permissions for specific files
chmod 644 ./querybird-data/secrets/secrets.json
chmod 644 ./querybird-data/configs/*.yml
```

### Debug Mode

```bash
# Run with debug logging
docker-compose run --rm querybird-cli start --log-level debug

# Run job with debug logging
docker-compose run --rm querybird-cli run-once --job-id job-name --log-level debug
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

### Health Checks

```bash
# Check container health
docker inspect querybird --format='{{.State.Health.Status}}'

# Manual health check
docker-compose run --rm querybird-cli health

# Check database connections
docker-compose run --rm querybird-cli secrets list
```

## Contributing

See [CONTRIBUTING.md](CONTRIBUTING.md) for development guidelines and contribution instructions.

## Security

See [SECURITY.md](SECURITY.md) for security policies and vulnerability reporting.

## License

MIT – see [LICENSE](LICENSE)
