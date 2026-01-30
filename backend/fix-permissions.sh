#!/bin/bash

# PostgreSQL Permission Fix Script
# This script fixes the "permission denied for schema public" error

echo "PostgreSQL Permission Fix Script"
echo "================================="
echo ""

# Get database name from .env file if it exists
if [ -f .env ]; then
  DB_NAME=$(grep DATABASE_URL .env | sed -n 's/.*\/\([^?]*\).*/\1/p')
  if [ -z "$DB_NAME" ]; then
    DB_NAME="admin_panel"
  fi
else
  DB_NAME="admin_panel"
fi

echo "Database: $DB_NAME"
read -p "PostgreSQL username [default: $(whoami)]: " DB_USER
DB_USER=${DB_USER:-$(whoami)}

echo ""
echo "Fixing permissions for user: $DB_USER"
echo ""

# Check if psql is available
if ! command -v psql &> /dev/null; then
  echo "Error: psql command not found. Please install PostgreSQL client."
  exit 1
fi

# Run the SQL commands
psql -U postgres -d "$DB_NAME" << SQL
-- Grant schema permissions
GRANT USAGE, CREATE ON SCHEMA public TO "$DB_USER";

-- Grant database privileges
GRANT ALL PRIVILEGES ON DATABASE "$DB_NAME" TO "$DB_USER";

-- Grant table permissions (for existing and future tables)
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON TABLES TO "$DB_USER";
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON SEQUENCES TO "$DB_USER";
SQL

if [ $? -eq 0 ]; then
  echo ""
  echo "✅ Permissions fixed successfully!"
  echo "You can now run: npm run prisma:migrate"
else
  echo ""
  echo "❌ Error fixing permissions."
  echo "Try running manually:"
  echo "  psql -U postgres -d $DB_NAME"
  echo "  Then run the SQL commands from fix-permissions.sql"
fi
