-- PostgreSQL Permission Fix Script
-- Run this script if you encounter "permission denied for schema public" error
-- Usage: psql -U postgres -d admin_panel -f fix-permissions.sql

-- Replace 'your_username' with your actual database username
-- Or use: \set username 'your_username'

-- Grant schema permissions
GRANT USAGE, CREATE ON SCHEMA public TO CURRENT_USER;

-- Grant database privileges
GRANT ALL PRIVILEGES ON DATABASE admin_panel TO CURRENT_USER;

-- Grant table permissions (for existing and future tables)
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON TABLES TO CURRENT_USER;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON SEQUENCES TO CURRENT_USER;

-- If the above doesn't work, try as superuser:
-- GRANT ALL ON SCHEMA public TO PUBLIC;
