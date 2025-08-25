# QueryBird - Single Instance Job Scheduler

QueryBird is a powerful job scheduler that can execute database queries, HTTP requests, and apply JSONata transformations to the results.

## Features

- **Database Support**: PostgreSQL and MySQL connections
- **HTTP Integration**: Make HTTP requests and process responses
- **JSONata Transformations**: Powerful data transformation using JSONata expressions
- **Flexible Scheduling**: Cron-based job scheduling
- **Multiple Outputs**: Support for webhooks, HTTP endpoints, files, and S3
- **Secrets Management**: Secure handling of connection strings and API keys

## Data Transformation with Database Results

QueryBird now supports an enhanced database result format that makes JSONata transformations more intuitive and readable.

### Database Result Format

When you have multiple database connections, QueryBird automatically creates a nested object structure:

```
{
  "production": {
    "customers": [...],
    "orders": [...]
  },
  "staging": {
    "customers": [...],
    "orders": [...]
  }
}
```

For example:

- `production.customers` - Results from the `customers` query in the `production` database
- `staging.orders` - Results from the `orders` query in the `staging` database

### Example Configuration

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

- **Direct access**: `production.customers` - Access all customer records from production
- **Field access**: `production.customers.name` - Access the name field from production customers
- **Filtering**: `production.customers[name = "John"]` - Filter production customers by name
- **Aggregation**: `$count(production.customers)` - Count production customers
- **Merging**: `$merge([production.customers, staging.customers])` - Combine results from both databases

**Note**: The new `db_name.sql_name` format creates nested objects, so you can access data using standard dot notation in JSONata expressions.

### Benefits

1. **Clearer Syntax**: `production.customers` is more intuitive than `production_customers`
2. **Better Readability**: The dot notation makes it clear which database and query the data comes from
3. **Consistent with JSONata**: Follows standard JSONata object access patterns
4. **Easier Maintenance**: Clear separation between database names and query names

## Installation

### From Source

```bash
# Clone the repository
git clone https://github.com/YOUR_USERNAME/querybird.git
cd querybird

# Install dependencies
bun install

# Build the project
bun run build
```

### Using Bun

```bash
# Install globally
bun install -g @your-org/querybird

# Or run directly
bunx @your-org/querybird
```

### Binary Installation

Download the latest release from [GitHub Releases](https://github.com/YOUR_USERNAME/querybird/releases) and follow the installation instructions.

## Usage

### Start the Scheduler

```bash
bun run start --config-dir ./configs --secrets-dir ./secrets
```

### Run a Job Once

```bash
bun run run-once --job-id example-job --config-dir ./configs --secrets-dir ./secrets
```

### Configuration

Jobs are configured using YAML files in the configs directory. Each job defines:

- **Input**: Database connections and SQL queries or HTTP endpoints
- **Transform**: JSONata expression to transform the data
- **Output**: Where to send the transformed data
- **Schedule**: Cron expression for when to run the job

### Secrets Management

Secrets are stored in the secrets directory and referenced in configs using the `!secrets` prefix:

```yaml
connection_info: '!secrets database.production.connection_string'
```

## Examples

See the `configs/` directory for example job configurations:

- `sync-users.yml` - Sync user data from multiple PostgreSQL databases
- `example-db-transform.yml` - Example showing the new database result format

## Development

```bash
# Install dependencies
bun install

# Run tests
bun test

# Build
bun run build

# Run in development mode
bun run dev
```

## Contributing

We welcome contributions! Please see our [Contributing Guide](CONTRIBUTING.md) for details on how to submit pull requests, report issues, and contribute to the project.

## Security

If you discover a security vulnerability, please report it privately to [security@querybird.dev](mailto:security@querybird.dev). See our [Security Policy](SECURITY.md) for more details.

## Code of Conduct

This project adheres to a [Code of Conduct](CODE_OF_CONDUCT.md). By participating, you are expected to uphold this code.

## License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## Support

- 📖 [Documentation](https://github.com/YOUR_USERNAME/querybird#readme)
- 🐛 [Report a Bug](https://github.com/YOUR_USERNAME/querybird/issues)
- 💡 [Request a Feature](https://github.com/YOUR_USERNAME/querybird/issues)
- 🤝 [Contributing](CONTRIBUTING.md)
