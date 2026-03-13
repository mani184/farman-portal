-- Farman Connect Database Schema
-- MySQL Database for Wi-Fi Captive Portal

CREATE DATABASE IF NOT EXISTS farman_connect;
USE farman_connect;

-- Admins Table
CREATE TABLE IF NOT EXISTS admins (
    id INT AUTO_INCREMENT PRIMARY KEY,
    username VARCHAR(50) UNIQUE NOT NULL,
    email VARCHAR(100) UNIQUE NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    full_name VARCHAR(100),
    phone VARCHAR(20),
    role ENUM('super_admin', 'admin') DEFAULT 'admin',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    last_login TIMESTAMP NULL,
    is_active BOOLEAN DEFAULT TRUE
);

-- Sites Table (Wi-Fi Locations)
CREATE TABLE IF NOT EXISTS sites (
    id INT AUTO_INCREMENT PRIMARY KEY,
    name VARCHAR(100) NOT NULL,
    location VARCHAR(255),
    description TEXT,
    omada_site_id VARCHAR(50),
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);

-- Devices Table (Access Points)
CREATE TABLE IF NOT EXISTS devices (
    id INT AUTO_INCREMENT PRIMARY KEY,
    site_id INT,
    name VARCHAR(100) NOT NULL,
    mac_address VARCHAR(17) UNIQUE,
    ip_address VARCHAR(45),
    model VARCHAR(50),
    firmware VARCHAR(50),
    status ENUM('online', 'offline', 'upgrading') DEFAULT 'offline',
    last_seen TIMESTAMP NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (site_id) REFERENCES sites(id) ON DELETE SET NULL
);

-- Bundles Table (Pricing Plans)
CREATE TABLE IF NOT EXISTS bundles (
    id INT AUTO_INCREMENT PRIMARY KEY,
    name VARCHAR(100) NOT NULL,
    description TEXT,
    duration_hours INT NOT NULL,
    price DECIMAL(10, 2) NOT NULL,
    currency VARCHAR(3) DEFAULT 'TZS',
    data_limit_mb BIGINT,
    is_active BOOLEAN DEFAULT TRUE,
    sort_order INT DEFAULT 0,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);

-- Clients Table (Authorized Users)
CREATE TABLE IF NOT EXISTS clients (
    id INT AUTO_INCREMENT PRIMARY KEY,
    mac_address VARCHAR(17) NOT NULL,
    bundle_id INT,
    site_id INT,
    phone VARCHAR(20),
    network VARCHAR(20),
    client_id VARCHAR(50) UNIQUE,
    ip_address VARCHAR(45),
    authorized_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    expires_at TIMESTAMP NULL,
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (bundle_id) REFERENCES bundles(id) ON DELETE SET NULL,
    FOREIGN KEY (site_id) REFERENCES sites(id) ON DELETE SET NULL
);

-- Transactions Table (Payment History)
CREATE TABLE IF NOT EXISTS transactions (
    id INT AUTO_INCREMENT PRIMARY KEY,
    transaction_id VARCHAR(100) UNIQUE NOT NULL,
    client_id VARCHAR(50),
    bundle_id INT,
    amount DECIMAL(10, 2) NOT NULL,
    currency VARCHAR(3) DEFAULT 'TZS',
    network VARCHAR(20),
    phone VARCHAR(20),
    status ENUM('pending', 'completed', 'failed', 'refunded') DEFAULT 'pending',
    payment_method VARCHAR(50),
    azampay_ref VARCHAR(100),
    payment_details JSON,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (bundle_id) REFERENCES bundles(id) ON DELETE SET NULL
);

-- Portal Config Table
CREATE TABLE IF NOT EXISTS portal_config (
    id INT AUTO_INCREMENT PRIMARY KEY,
    site_id INT,
    config_key VARCHAR(50) NOT NULL,
    config_value TEXT,
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    UNIQUE KEY unique_site_config (site_id, config_key),
    FOREIGN KEY (site_id) REFERENCES sites(id) ON DELETE CASCADE
);

-- Analytics Table (Usage Tracking)
CREATE TABLE IF NOT EXISTS analytics (
    id INT AUTO_INCREMENT PRIMARY KEY,
    client_id VARCHAR(50),
    site_id INT,
    bytes_used BIGINT DEFAULT 0,
    session_duration INT DEFAULT 0,
    session_start TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    session_end TIMESTAMP NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (site_id) REFERENCES sites(id) ON DELETE SET NULL
);

-- Insert Default Admin (password: admin123)
INSERT INTO admins (username, email, password_hash, full_name, role) 
VALUES ('admin', 'admin@farmanconnect.com', '$2a$10$92IXUNpkjO0rOQ5byMi.Ye4oKoEa3Ro9llC/.og/at2.uheWG/igi', 'System Administrator', 'super_admin');

-- Insert Default Sites
INSERT INTO sites (name, location, description, omada_site_id) VALUES
('Main Location', 'Nungwi', 'Nungwi Beach Wi-Fi Zone', 'site_nungwi'),
('Secondary Location', 'Bububu', 'Bububu Town Wi-Fi', 'site_bububu');

-- Insert Default Bundles
INSERT INTO bundles (name, description, duration_hours, price, sort_order) VALUES
('1 Hour', '1 Hour unlimited access', 1, 500, 1),
('2 Hours', '2 Hours unlimited access', 2, 900, 2),
('1 Day', '24 Hours unlimited access', 24, 2000, 3),
('1 Week', '7 Days unlimited access', 168, 10000, 4),
('1 Month', '30 Days unlimited access', 720, 35000, 5);

-- Insert Default Portal Config
INSERT INTO portal_config (site_id, config_key, config_value) VALUES
(1, 'portal_title', 'Farman Connect'),
(1, 'portal_subtitle', 'Welcome to Farman Connect Wi-Fi'),
(1, 'logo_url', '/img/logo.png'),
(1, 'primary_color', '#2563eb'),
(1, 'background_color', '#1e3a8a');
