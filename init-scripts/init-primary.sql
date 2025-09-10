-- Primary PostgreSQL Database Initialization Script
-- Database: querybird_prod

-- Create additional databases
CREATE DATABASE querybird_analytics;
CREATE DATABASE querybird_logs;

-- Create database users/roles with different access levels
CREATE USER ""john.doe"" WITH PASSWORD 'john_password_123';
CREATE USER ""jane.smith"" WITH PASSWORD 'jane_password_123';
CREATE USER ""bob.wilson"" WITH PASSWORD 'bob_password_123';
CREATE USER ""alice.johnson"" WITH PASSWORD 'alice_password_123';
CREATE USER developer1 WITH PASSWORD 'dev_password_123';
CREATE USER readonly_user WITH PASSWORD 'readonly_password_123';
CREATE USER analyst_user WITH PASSWORD 'analyst_password_123';
CREATE USER manager_user WITH PASSWORD 'manager_password_123';

-- Grant superuser privileges to admin (already exists)
-- admin user is created by POSTGRES_USER environment variable

-- Grant database creation privileges
GRANT CREATEDB ON DATABASE querybird_prod TO ""john.doe"";
GRANT CREATEDB ON DATABASE querybird_analytics TO ""john.doe"";

-- Grant connection privileges to databases
GRANT CONNECT ON DATABASE querybird_prod TO "jane.smith", "bob.wilson", "alice.johnson", developer1, readonly_user, analyst_user, manager_user;
GRANT CONNECT ON DATABASE querybird_analytics TO "jane.smith", "bob.wilson", developer1, readonly_user, analyst_user, manager_user;
GRANT CONNECT ON DATABASE querybird_logs TO "jane.smith", developer1, readonly_user, analyst_user;

-- Grant usage on schemas
GRANT USAGE ON SCHEMA public TO "jane.smith", "bob.wilson", "alice.johnson", developer1, readonly_user, analyst_user, manager_user;

-- Create sample tables for testing
CREATE TABLE sample_data (
    id SERIAL PRIMARY KEY,
    name VARCHAR(100) NOT NULL,
    value INTEGER,
    category VARCHAR(50),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE metrics (
    id SERIAL PRIMARY KEY,
    metric_name VARCHAR(100) NOT NULL,
    metric_value DECIMAL(10,2),
    timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Insert sample data
INSERT INTO sample_data (name, value, category) VALUES
('Test Item 1', 100, 'category_a'),
('Test Item 2', 200, 'category_b'),
('Test Item 3', 300, 'category_a');

INSERT INTO metrics (metric_name, metric_value) VALUES
('cpu_usage', 75.5),
('memory_usage', 82.3),
('disk_usage', 45.1);

-- Grant table permissions based on user roles
-- Admin users (full access)
GRANT ALL PRIVILEGES ON ALL TABLES IN SCHEMA public TO "john.doe";
GRANT ALL PRIVILEGES ON ALL SEQUENCES IN SCHEMA public TO "john.doe";

-- Manager users (read/write access to most tables)
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO "jane.smith", manager_user;
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO "jane.smith", manager_user;

-- Developer users (read/write access to development tables)
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO "bob.wilson", developer1;
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO "bob.wilson", developer1;

-- Analyst users (read access to analytics tables, limited write)
GRANT SELECT ON ALL TABLES IN SCHEMA public TO "alice.johnson", analyst_user;
GRANT INSERT, UPDATE ON metrics TO "alice.johnson", analyst_user;
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO "alice.johnson", analyst_user;

-- Read-only users (select only)
GRANT SELECT ON ALL TABLES IN SCHEMA public TO readonly_user;
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO readonly_user;

-- Create indexes for better performance
CREATE INDEX idx_sample_data_category ON sample_data(category);
CREATE INDEX idx_metrics_timestamp ON metrics(timestamp);

-- Create a view for readonly access
CREATE VIEW readonly_metrics AS
SELECT metric_name, metric_value, timestamp
FROM metrics
WHERE timestamp > CURRENT_TIMESTAMP - INTERVAL '30 days';

-- Grant view permissions
GRANT SELECT ON readonly_metrics TO readonly_user, analyst_user, manager_user;

-- Create a function to get database user info
CREATE OR REPLACE FUNCTION get_db_user_info()
RETURNS TABLE (
    username VARCHAR,
    database_name VARCHAR,
    can_login BOOLEAN,
    is_superuser BOOLEAN,
    can_create_db BOOLEAN,
    can_create_role BOOLEAN
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        r.rolname::VARCHAR,
        current_database()::VARCHAR,
        r.rolcanlogin,
        r.rolsuper,
        r.rolcreatedb,
        r.rolcreaterole
    FROM pg_roles r
    WHERE r.rolname IN (
        '"john.doe"', '"jane.smith"', '"bob.wilson"', '"alice.johnson"', 
        'developer1', 'readonly_user', 'analyst_user', 'manager_user'
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant function execution to appropriate users
GRANT EXECUTE ON FUNCTION get_db_user_info() TO "jane.smith", "bob.wilson", "alice.johnson", developer1, analyst_user, manager_user;
