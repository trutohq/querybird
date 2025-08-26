# QueryBird Documentation

## Overview

QueryBird is a single-instance job scheduler that can execute database queries, HTTP requests, and transform the results using JSONata.

### Features

- Database Support: PostgreSQL and MySQL connections
- HTTP Integration: Make HTTP requests and process responses
- JSONata Transformations: Powerful data transformation using JSONata expressions
- Flexible Scheduling: Cron-based job scheduling
- Multiple Outputs: Webhooks, HTTP endpoints, files, and S3
- Secrets Management: Secure handling of connection strings and API keys

## Data Transformation with Database Results

QueryBird supports a database result structure that makes JSONata transformations intuitive.

### Example

```yaml
input:
  postgres:
    - name: production
      connection_info: '!secrets example.database.production'
      sql:
        - name: customers
          sql: 'SELECT id, name, email FROM customers'
        - name: orders
          sql: 'SELECT id, customer_id, amount FROM orders'
    - name: staging
      connection_info: '!secrets example.database.staging'
      sql:
        - name: customers
          sql: 'SELECT id, name, email FROM customers'
        - name: orders
          sql: 'SELECT id, customer_id, amount FROM orders'

transform: |-
  {
    "production_customers": production.customers,
    "staging_customers": staging.customers,
    "all_customers": $merge([production.customers, staging.customers]),
    "customer_count": $count($merge([production.customers, staging.customers]))
  }
```

### JSONata Access Patterns

- Direct: `production.customers`
- Field: `production.customers.name`
- Filter: `production.customers[name = "John"]`
- Aggregate: `$count(production.customers)`
- Merge: `$merge([production.customers, staging.customers])`

### Connection Info Context

The `connection_info` object is automatically available in the jsonata transform context, providing access to database connection details:

#### Single Database Connection

```jsonata
{
  "db_name": connection_info.db_name,
  "region": connection_info.region,
  "host": connection_info.host,
  "port": connection_info.port,
  "user": connection_info.user,
  "ssl": connection_info.ssl
}
```

#### Multiple Database Connections

For multiple connections, each database has its own `connection_info` context:

```jsonata
{
  "test1_db": test1.connection_info.db_name,
  "test1_region": test1.connection_info.region,
  "wsrwr_db": wsrwr.connection_info.db_name,
  "wsrwr_region": wsrwr.connection_info.region
}
```

You can also access all connection info at the root level:

```jsonata
{
  "test1_info": connections_info.test1,
  "wsrwr_info": connections_info.wsrwr
}
```

This allows you to dynamically reference connection properties in your transforms instead of hardcoding values:

```yaml
transform: |-
  users.{
    "Entity Name": username & "::" & connection_info.db_name & "::" & connection_info.region,
    "Database": connection_info.db_name,
    "Region": connection_info.region
  }
```

The `connection_info` is parsed from your database connection configuration and supports both JSON and URL formats.

## Installation (Developers)

### From Source

```bash
git clone https://github.com/YOUR_USERNAME/querybird.git
cd querybird
bun install
bun run build
```

### Using Bun

```bash
# Install globally
bun install -g @trutohq/querybird

# Or run directly
bunx @trutohq/querybird
```

### Binary Installation

Download binaries from Releases and pick for your OS/CPU:

- Linux: `querybird-linux-x64` or `querybird-linux-arm64`
- macOS: `querybird-darwin-x64` or `querybird-darwin-arm64`
- Windows: `querybird-windows-x64.exe` or `querybird-windows-arm64.exe`

Make executable and place on PATH as needed.

## Usage

### Start the Scheduler

```bash
bun run start --config-dir ./configs --secrets-dir ./secrets
```

### Run a Job Once

```bash
bun run run-once --job-id example-job --config-dir ./configs --secrets-dir ./secrets
```

## Configuration

- Config files in `configs/*.yml`
- Secrets stored in `secrets/secrets.json`
- Reference secrets with `!secrets`

### Secrets Example

```yaml
connection_info: '!secrets database.production.connection_string'
```

## Examples

- `configs/sync-users.yml` – Sync user data from multiple PostgreSQL databases
- `configs/example-db-transform.yml` – Demonstrates database result structure + JSONata

## Development

```bash
bun install
bun test
bun run build
bun run dev
```

## Contributing

See [CONTRIBUTING.md](CONTRIBUTING.md)

## Security

See [SECURITY.md](SECURITY.md)

## Code of Conduct

See [CODE_OF_CONDUCT.md](CODE_OF_CONDUCT.md)

## License

MIT – see [LICENSE](LICENSE)
