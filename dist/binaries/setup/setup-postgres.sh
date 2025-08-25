#!/bin/bash
# QueryBird PostgreSQL Setup Script

set -e

CONFIG_DIR="${CONFIG_DIR:-/opt/querybird}"
SECRETS_DIR="${SECRETS_DIR:-/opt/querybird/secrets}"

echo "🔧 Setting up QueryBird PostgreSQL configuration..."

# Create directories
mkdir -p "${CONFIG_DIR}"/{configs,secrets,watermarks,outputs,logs}
chmod 700 "${SECRETS_DIR}"

# Run init-postgres command using the existing CLI
echo "📊 Initializing PostgreSQL configuration..."
querybird init-postgres --config-dir "${CONFIG_DIR}/configs" --secrets-dir "${SECRETS_DIR}"

echo "✅ PostgreSQL setup complete!"
echo "Next steps:"
echo "1. Edit configuration files in ${CONFIG_DIR}/configs"
echo "2. Start the service: querybird start --config-dir ${CONFIG_DIR}/configs"
echo "3. Or install as system service: sudo systemctl enable querybird"
