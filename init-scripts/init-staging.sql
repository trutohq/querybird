-- Staging PostgreSQL Database Initialization Script
-- Database: querybird_staging

-- Create additional databases for staging
CREATE DATABASE querybird_staging_analytics;
CREATE DATABASE querybird_staging_logs;

-- Create database users/roles for staging environment
CREATE USER staging_admin WITH PASSWORD 'staging_admin_password_123';
CREATE USER staging_dev WITH PASSWORD 'staging_dev_password_123';
CREATE USER staging_tester WITH PASSWORD 'staging_tester_password_123';
CREATE USER staging_analyst WITH PASSWORD 'staging_analyst_password_123';
CREATE USER staging_readonly WITH PASSWORD 'staging_readonly_password_123';
CREATE USER qa_user WITH PASSWORD 'qa_password_123';
CREATE USER staging_manager WITH PASSWORD 'staging_manager_password_123';

-- Grant database creation privileges
GRANT CREATEDB ON DATABASE querybird_staging TO staging_admin;
GRANT CREATEDB ON DATABASE querybird_staging_analytics TO staging_admin;

-- Grant connection privileges to databases
GRANT CONNECT ON DATABASE querybird_staging TO staging_dev, staging_tester, staging_analyst, staging_readonly, qa_user, staging_manager;
GRANT CONNECT ON DATABASE querybird_staging_analytics TO staging_dev, staging_tester, staging_analyst, staging_readonly, qa_user, staging_manager;
GRANT CONNECT ON DATABASE querybird_staging_logs TO staging_dev, staging_tester, staging_readonly, qa_user;

-- Grant usage on schemas
GRANT USAGE ON SCHEMA public TO staging_dev, staging_tester, staging_analyst, staging_readonly, qa_user, staging_manager;

-- Create sample tables for staging testing
CREATE TABLE staging_users (
    id SERIAL PRIMARY KEY,
    username VARCHAR(50) UNIQUE NOT NULL,
    email VARCHAR(100) UNIQUE NOT NULL,
    environment VARCHAR(20) DEFAULT 'staging',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE staging_features (
    id SERIAL PRIMARY KEY,
    feature_name VARCHAR(100) NOT NULL,
    status VARCHAR(20) DEFAULT 'testing',
    test_results JSONB,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE staging_logs (
    id SERIAL PRIMARY KEY,
    log_level VARCHAR(10) NOT NULL,
    message TEXT,
    source VARCHAR(50),
    timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Insert sample staging data
INSERT INTO staging_users (username, email) VALUES
('staging.user1', 'staging.user1@querybird.test'),
('staging.user2', 'staging.user2@querybird.test'),
('staging.user3', 'staging.user3@querybird.test');

INSERT INTO staging_features (feature_name, status, test_results) VALUES
('User Authentication', 'testing', '{"unit_tests": "passed", "integration_tests": "pending"}'),
('Data Export', 'testing', '{"unit_tests": "passed", "integration_tests": "failed"}'),
('API Endpoints', 'testing', '{"unit_tests": "pending", "integration_tests": "pending"}');

INSERT INTO staging_logs (log_level, message, source) VALUES
('INFO', 'Staging environment started', 'system'),
('DEBUG', 'Database connection established', 'database'),
('WARN', 'Feature flag not found', 'feature_manager');

-- Grant table permissions based on user roles
-- Staging admin (full access)
GRANT ALL PRIVILEGES ON ALL TABLES IN SCHEMA public TO staging_admin;
GRANT ALL PRIVILEGES ON ALL SEQUENCES IN SCHEMA public TO staging_admin;

-- Staging manager (read/write access)
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO staging_manager;
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO staging_manager;

-- Staging developers (read/write access)
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO staging_dev;
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO staging_dev;

-- QA users (read/write access for testing)
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO qa_user, staging_tester;
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO qa_user, staging_tester;

-- Staging analysts (read access, limited write)
GRANT SELECT ON ALL TABLES IN SCHEMA public TO staging_analyst;
GRANT INSERT, UPDATE ON staging_logs TO staging_analyst;
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO staging_analyst;

-- Read-only users (select only)
GRANT SELECT ON ALL TABLES IN SCHEMA public TO staging_readonly;
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO staging_readonly;

-- Create indexes for better performance
CREATE INDEX idx_staging_users_username ON staging_users(username);
CREATE INDEX idx_staging_features_status ON staging_features(status);
CREATE INDEX idx_staging_logs_timestamp ON staging_logs(timestamp);
CREATE INDEX idx_staging_logs_level ON staging_logs(log_level);

-- Create a view for readonly access
CREATE VIEW staging_summary AS
SELECT 
    'users' as table_name,
    COUNT(*) as record_count,
    MAX(created_at) as last_updated
FROM staging_users
UNION ALL
SELECT 
    'features' as table_name,
    COUNT(*) as record_count,
    MAX(created_at) as last_updated
FROM staging_features
UNION ALL
SELECT 
    'logs' as table_name,
    COUNT(*) as record_count,
    MAX(created_at) as last_updated
FROM staging_logs;

-- Grant view permissions
GRANT SELECT ON staging_summary TO staging_readonly, staging_analyst, staging_manager;

-- Create a function to get staging environment info
CREATE OR REPLACE FUNCTION get_staging_info()
RETURNS TABLE (
    environment VARCHAR,
    database_name VARCHAR,
    user_count INTEGER,
    feature_count INTEGER,
    log_count INTEGER
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        'staging'::VARCHAR,
        current_database()::VARCHAR,
        (SELECT COUNT(*) FROM staging_users)::INTEGER,
        (SELECT COUNT(*) FROM staging_features)::INTEGER,
        (SELECT COUNT(*) FROM staging_logs)::INTEGER;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant function execution to appropriate users
GRANT EXECUTE ON FUNCTION get_staging_info() TO staging_dev, staging_tester, staging_analyst, staging_manager, qa_user;
