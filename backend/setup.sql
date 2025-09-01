-- WordMate Database Setup Script
-- Run this script to set up the database manually

-- Create databases
CREATE DATABASE IF NOT EXISTS wordmate CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
CREATE DATABASE IF NOT EXISTS wordmate_test CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- Create user for WordMate application
CREATE USER IF NOT EXISTS 'wordmate_user'@'localhost' IDENTIFIED BY 'wordmate_password';

-- Grant privileges
GRANT ALL PRIVILEGES ON wordmate.* TO 'wordmate_user'@'localhost';
GRANT ALL PRIVILEGES ON wordmate_test.* TO 'wordmate_user'@'localhost';

-- Apply changes
FLUSH PRIVILEGES;

-- Show created databases
SHOW DATABASES LIKE 'wordmate%';

-- Show user privileges
SHOW GRANTS FOR 'wordmate_user'@'localhost';
