-- MySQL Database Initialization Script
-- Database: querybird_mysql

-- Create additional databases
CREATE DATABASE querybird_mysql_analytics;
CREATE DATABASE querybird_mysql_logs;

-- Create users with different access levels
CREATE USER 'mysql_admin'@'%' IDENTIFIED BY 'mysql_admin_password_123';
CREATE USER 'mysql_dev'@'%' IDENTIFIED BY 'mysql_dev_password_123';
CREATE USER 'mysql_analyst'@'%' IDENTIFIED BY 'mysql_analyst_password_123';
CREATE USER 'mysql_readonly'@'%' IDENTIFIED BY 'mysql_readonly_password_123';
CREATE USER 'mysql_tester'@'%' IDENTIFIED BY 'mysql_tester_password_123';
CREATE USER 'mysql_manager'@'%' IDENTIFIED BY 'mysql_manager_password_123';
CREATE USER 'mysql_api'@'%' IDENTIFIED BY 'mysql_api_password_123';

-- Grant privileges to mysql_admin (superuser-like access)
GRANT ALL PRIVILEGES ON *.* TO 'mysql_admin'@'%' WITH GRANT OPTION;

-- Grant database creation privileges
GRANT CREATE ON *.* TO 'mysql_admin'@'%';

-- Grant access to main database
GRANT ALL PRIVILEGES ON querybird_mysql.* TO 'mysql_admin'@'%';
GRANT ALL PRIVILEGES ON querybird_mysql_analytics.* TO 'mysql_admin'@'%';
GRANT ALL PRIVILEGES ON querybird_mysql_logs.* TO 'mysql_admin'@'%';

-- Grant access to mysql_manager
GRANT SELECT, INSERT, UPDATE, DELETE, CREATE, DROP, INDEX, ALTER ON querybird_mysql.* TO 'mysql_manager'@'%';
GRANT SELECT, INSERT, UPDATE, DELETE ON querybird_mysql_analytics.* TO 'mysql_manager'@'%';
GRANT SELECT ON querybird_mysql_logs.* TO 'mysql_manager'@'%';

-- Grant access to mysql_dev
GRANT SELECT, INSERT, UPDATE, DELETE, CREATE, DROP, INDEX, ALTER ON querybird_mysql.* TO 'mysql_dev'@'%';
GRANT SELECT, INSERT, UPDATE, DELETE ON querybird_mysql_analytics.* TO 'mysql_dev'@'%';
GRANT SELECT, INSERT ON querybird_mysql_logs.* TO 'mysql_dev'@'%';

-- Grant access to mysql_analyst
GRANT SELECT ON querybird_mysql.* TO 'mysql_analyst'@'%';
GRANT SELECT, INSERT, UPDATE ON querybird_mysql_analytics.* TO 'mysql_analyst'@'%';
GRANT SELECT ON querybird_mysql_logs.* TO 'mysql_analyst'@'%';

-- Grant access to mysql_tester
GRANT SELECT, INSERT, UPDATE, DELETE ON querybird_mysql.* TO 'mysql_tester'@'%';
GRANT SELECT, INSERT, UPDATE, DELETE ON querybird_mysql_analytics.* TO 'mysql_tester'@'%';
GRANT SELECT, INSERT ON querybird_mysql_logs.* TO 'mysql_tester'@'%';

-- Grant access to mysql_api
GRANT SELECT, INSERT, UPDATE ON querybird_mysql.* TO 'mysql_api'@'%';
GRANT SELECT ON querybird_mysql_analytics.* TO 'mysql_api'@'%';
GRANT SELECT, INSERT ON querybird_mysql_logs.* TO 'mysql_api'@'%';

-- Grant access to mysql_readonly
GRANT SELECT ON querybird_mysql.* TO 'mysql_readonly'@'%';
GRANT SELECT ON querybird_mysql_analytics.* TO 'mysql_readonly'@'%';
GRANT SELECT ON querybird_mysql_logs.* TO 'mysql_readonly'@'%';

-- Use the main database
USE querybird_mysql;

-- Create sample tables
CREATE TABLE mysql_users (
    id INT AUTO_INCREMENT PRIMARY KEY,
    username VARCHAR(50) UNIQUE NOT NULL,
    email VARCHAR(100) UNIQUE NOT NULL,
    role VARCHAR(20) DEFAULT 'user',
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);

CREATE TABLE mysql_products (
    id INT AUTO_INCREMENT PRIMARY KEY,
    name VARCHAR(100) NOT NULL,
    description TEXT,
    price DECIMAL(10,2),
    category VARCHAR(50),
    stock_quantity INT DEFAULT 0,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE mysql_orders (
    id INT AUTO_INCREMENT PRIMARY KEY,
    user_id INT,
    product_id INT,
    quantity INT,
    total_amount DECIMAL(10,2),
    order_date TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    status VARCHAR(20) DEFAULT 'pending',
    FOREIGN KEY (user_id) REFERENCES mysql_users(id),
    FOREIGN KEY (product_id) REFERENCES mysql_products(id)
);

-- Insert sample data
INSERT INTO mysql_users (username, email, role) VALUES
('mysql.user1', 'mysql.user1@querybird.test', 'customer'),
('mysql.user2', 'mysql.user2@querybird.test', 'customer'),
('mysql.user3', 'mysql.user3@querybird.test', 'admin'),
('mysql.user4', 'mysql.user4@querybird.test', 'customer');

INSERT INTO mysql_products (name, description, price, category, stock_quantity) VALUES
('Product A', 'High-quality product A', 29.99, 'electronics', 100),
('Product B', 'Premium product B', 49.99, 'electronics', 50),
('Product C', 'Standard product C', 19.99, 'accessories', 200),
('Product D', 'Luxury product D', 99.99, 'luxury', 25);

INSERT INTO mysql_orders (user_id, product_id, quantity, total_amount, status) VALUES
(1, 1, 2, 59.98, 'completed'),
(2, 2, 1, 49.99, 'pending'),
(1, 3, 3, 59.97, 'shipped'),
(3, 4, 1, 99.99, 'completed');

-- Create indexes for better performance
CREATE INDEX idx_mysql_users_username ON mysql_users(username);
CREATE INDEX idx_mysql_users_email ON mysql_users(email);
CREATE INDEX idx_mysql_products_category ON mysql_products(category);
CREATE INDEX idx_mysql_orders_user_id ON mysql_orders(user_id);
CREATE INDEX idx_mysql_orders_status ON mysql_orders(status);

-- Create a view for readonly access
CREATE VIEW mysql_order_summary AS
SELECT 
    u.username,
    COUNT(o.id) as total_orders,
    SUM(o.total_amount) as total_spent,
    MAX(o.order_date) as last_order_date
FROM mysql_users u
LEFT JOIN mysql_orders o ON u.id = o.user_id
GROUP BY u.id, u.username;

-- Grant view permissions
GRANT SELECT ON mysql_order_summary TO 'mysql_readonly'@'%', 'mysql_analyst'@'%', 'mysql_manager'@'%';

-- Create stored procedure to get user statistics
DELIMITER //
CREATE PROCEDURE GetUserStats(IN user_id_param INT)
READS SQL DATA
SQL SECURITY DEFINER
BEGIN
    SELECT 
        u.username,
        u.email,
        u.role,
        COUNT(o.id) as order_count,
        SUM(o.total_amount) as total_spent,
        MAX(o.order_date) as last_order_date
    FROM mysql_users u
    LEFT JOIN mysql_orders o ON u.id = o.user_id
    WHERE u.id = user_id_param
    GROUP BY u.id, u.username, u.email, u.role;
END //
DELIMITER ;

-- Grant procedure execution
GRANT EXECUTE ON PROCEDURE GetUserStats TO 'mysql_dev'@'%', 'mysql_analyst'@'%', 'mysql_manager'@'%';

-- Create trigger to update product stock
DELIMITER //
CREATE TRIGGER after_order_insert
AFTER INSERT ON mysql_orders
FOR EACH ROW
BEGIN
    UPDATE mysql_products 
    SET stock_quantity = stock_quantity - NEW.quantity 
    WHERE id = NEW.product_id;
END //
DELIMITER ;

-- Grant SELECT permissions on mysql.user system table
GRANT SELECT ON mysql.user TO 'admin'@'%';
GRANT SELECT ON mysql.user TO 'mysql_analyst'@'%';
GRANT SELECT ON mysql.user TO 'mysql_readonly'@'%';

-- Flush privileges to apply changes
FLUSH PRIVILEGES;
