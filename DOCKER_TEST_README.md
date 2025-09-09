# QueryBird Test Environment - Docker Compose Setup

This Docker Compose configuration creates a complete test environment with three databases and multiple users for testing QueryBird functionality.

## 🚀 Quick Start

```bash
# Start all services
docker-compose -f docker-compose.test.yml up -d

# View logs
docker-compose -f docker-compose.test.yml logs -f

# Stop all services
docker-compose -f docker-compose.test.yml down

# Stop and remove volumes (clean slate)
docker-compose -f docker-compose.test.yml down -v
```

## 🗄️ Database Services

### 1. PostgreSQL Primary (Production-like)

- **Container**: `querybird-postgres-primary`
- **Port**: `5432`
- **Database**: `querybird_prod`
- **Admin User**: `admin` / `admin_password_123`

**Additional Databases Created**:

- `querybird_analytics`
- `querybird_logs`

**Database Users Created**:

- `john.doe` / `john_password_123` - Admin (full access)
- `jane.smith` / `jane_password_123` - Manager (read/write)
- `bob.wilson` / `bob_password_123` - Developer (read/write)
- `alice.johnson` / `alice_password_123` - Analyst (read + limited write)
- `developer1` / `dev_password_123` - Developer (read/write)
- `readonly_user` / `readonly_password_123` - Read-only
- `analyst_user` / `analyst_password_123` - Analyst (read + limited write)
- `manager_user` / `manager_password_123` - Manager (read/write)

### 2. PostgreSQL Staging

- **Container**: `querybird-postgres-staging`
- **Port**: `5433`
- **Database**: `querybird_staging`
- **Admin User**: `admin` / `admin_password_123`

**Additional Databases Created**:

- `querybird_staging_analytics`
- `querybird_staging_logs`

**Database Users Created**:

- `staging_admin` / `staging_admin_password_123` - Admin (full access)
- `staging_dev` / `staging_dev_password_123` - Developer (read/write)
- `staging_tester` / `staging_tester_password_123` - QA Tester (read/write)
- `staging_analyst` / `staging_analyst_password_123` - Analyst (read + limited write)
- `staging_readonly` / `staging_readonly_password_123` - Read-only
- `qa_user` / `qa_password_123` - QA User (read/write)
- `staging_manager` / `staging_manager_password_123` - Manager (read/write)

### 3. MySQL Test

- **Container**: `querybird-mysql-test`
- **Port**: `3306`
- **Database**: `querybird_mysql`
- **Admin User**: `admin` / `admin_password_123`
- **Root Password**: `root_password_123`

**Additional Databases Created**:

- `querybird_mysql_analytics`
- `querybird_mysql_logs`

**Database Users Created**:

- `mysql_admin` / `mysql_admin_password_123` - Admin (full access)
- `mysql_dev` / `mysql_dev_password_123` - Developer (read/write)
- `mysql_analyst` / `mysql_analyst_password_123` - Analyst (read + limited write)
- `mysql_readonly` / `mysql_readonly_password_123` - Read-only
- `mysql_tester` / `mysql_tester_password_123` - Tester (read/write)
- `mysql_manager` / `mysql_manager_password_123` - Manager (read/write)
- `mysql_api` / `mysql_api_password_123` - API User (read/write)

## 🛠️ Management Tools

### pgAdmin (PostgreSQL Management)

- **URL**: http://localhost:8080
- **Email**: `admin@querybird.test`
- **Password**: `admin123`
- **Auto-configured servers**: Primary and Staging PostgreSQL databases

### phpMyAdmin (MySQL Management)

- **URL**: http://localhost:8081
- **Username**: `admin`
- **Password**: `admin_password_123`
- **Auto-connected to**: MySQL database

## 🔐 Access Control Matrix

### PostgreSQL Primary

| User            | Database Access | Table Permissions                 | Special Privileges |
| --------------- | --------------- | --------------------------------- | ------------------ |
| `john.doe`      | All DBs         | ALL PRIVILEGES                    | CREATEDB           |
| `jane.smith`    | prod, analytics | SELECT, INSERT, UPDATE, DELETE    | -                  |
| `bob.wilson`    | prod, analytics | SELECT, INSERT, UPDATE, DELETE    | -                  |
| `alice.johnson` | prod, analytics | SELECT + INSERT/UPDATE on metrics | -                  |
| `developer1`    | prod, analytics | SELECT, INSERT, UPDATE, DELETE    | -                  |
| `readonly_user` | prod, analytics | SELECT only                       | -                  |
| `analyst_user`  | prod, analytics | SELECT + INSERT/UPDATE on metrics | -                  |
| `manager_user`  | prod, analytics | SELECT, INSERT, UPDATE, DELETE    | -                  |

### PostgreSQL Staging

| User               | Database Access          | Table Permissions              | Special Privileges |
| ------------------ | ------------------------ | ------------------------------ | ------------------ |
| `staging_admin`    | All DBs                  | ALL PRIVILEGES                 | CREATEDB           |
| `staging_dev`      | staging, analytics, logs | SELECT, INSERT, UPDATE, DELETE | -                  |
| `staging_tester`   | staging, analytics, logs | SELECT, INSERT, UPDATE, DELETE | -                  |
| `staging_analyst`  | staging, analytics       | SELECT + INSERT/UPDATE on logs | -                  |
| `staging_readonly` | staging, analytics       | SELECT only                    | -                  |
| `qa_user`          | staging, analytics, logs | SELECT, INSERT, UPDATE, DELETE | -                  |
| `staging_manager`  | staging, analytics       | SELECT, INSERT, UPDATE, DELETE | -                  |

### MySQL

| User             | Database Access                                                        | Table Permissions                                          | Special Privileges |
| ---------------- | ---------------------------------------------------------------------- | ---------------------------------------------------------- | ------------------ |
| `mysql_admin`    | All DBs                                                                | ALL PRIVILEGES                                             | GRANT OPTION       |
| `mysql_dev`      | mysql, analytics, logs                                                 | SELECT, INSERT, UPDATE, DELETE, CREATE, DROP, INDEX, ALTER | -                  |
| `mysql_analyst`  | mysql (SELECT), analytics (SELECT/INSERT/UPDATE), logs (SELECT)        | Limited based on role                                      | -                  |
| `mysql_readonly` | All DBs                                                                | SELECT only                                                | -                  |
| `mysql_tester`   | mysql, analytics, logs                                                 | SELECT, INSERT, UPDATE, DELETE                             | -                  |
| `mysql_manager`  | mysql (full), analytics (full), logs (SELECT)                          | Full on main, limited on others                            | -                  |
| `mysql_api`      | mysql (SELECT/INSERT/UPDATE), analytics (SELECT), logs (SELECT/INSERT) | API-appropriate access                                     | -                  |

## 📊 Sample Data

### PostgreSQL Primary

- `sample_data` table with test items
- `metrics` table with system metrics
- `readonly_metrics` view for restricted access

### PostgreSQL Staging

- `staging_users` table with test users
- `staging_features` table with feature testing data
- `staging_logs` table with application logs
- `staging_summary` view for overview

### MySQL

- `mysql_users` table with customer data
- `mysql_products` table with product catalog
- `mysql_orders` table with order data
- `mysql_order_summary` view for analytics
- `GetUserStats` stored procedure
- `after_order_insert` trigger for inventory management

## 🔧 Testing QueryBird

### Connection Examples

#### PostgreSQL Primary

```yaml
# Example connection info for QueryBird config
connection_info: '!secrets test.database.primary'
# Host: localhost
# Port: 5432
# Database: querybird_prod
# Username: john.doe
# Password: john_password_123
```

#### PostgreSQL Staging

```yaml
# Example connection info for QueryBird config
connection_info: '!secrets test.database.staging'
# Host: localhost
# Port: 5433
# Database: querybird_staging
# Username: staging_dev
# Password: staging_dev_password_123
```

#### MySQL

```yaml
# Example connection info for QueryBird config
connection_info: '!secrets test.database.mysql'
# Host: localhost
# Port: 3306
# Database: querybird_mysql
# Username: mysql_dev
# Password: mysql_dev_password_123
```

## 🧹 Cleanup

```bash
# Stop and remove containers
docker-compose -f docker-compose.test.yml down

# Remove volumes (this will delete all data)
docker-compose -f docker-compose.test.yml down -v

# Remove images (optional)
docker-compose -f docker-compose.test.yml down --rmi all
```

## 🚨 Security Notes

⚠️ **WARNING**: This setup is for testing purposes only!

- All passwords are hardcoded and easily guessable
- No SSL/TLS encryption enabled
- All services exposed on localhost
- No firewall rules or network isolation
- **DO NOT USE IN PRODUCTION**

## 📝 Troubleshooting

### Common Issues

1. **Port conflicts**: Ensure ports 5432, 5433, 3306, 8080, 8081 are available
2. **Permission denied**: Check if Docker has permission to bind to ports
3. **Database connection failed**: Wait for health checks to pass before connecting
4. **pgAdmin connection issues**: Verify the servers.json file is properly mounted

### Health Check Commands

```bash
# Check PostgreSQL Primary
docker exec querybird-postgres-primary pg_isready -U admin -d querybird_prod

# Check PostgreSQL Staging
docker exec querybird-postgres-staging pg_isready -U admin -d querybird_staging

# Check MySQL
docker exec querybird-mysql-test mysqladmin ping -h localhost -u admin -padmin_password_123
```

### View Logs

```bash
# All services
docker-compose -f docker-compose.test.yml logs

# Specific service
docker-compose -f docker-compose.test.yml logs postgres-primary
docker-compose -f docker-compose.test.yml logs mysql-test
```
