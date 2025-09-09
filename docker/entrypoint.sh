#!/bin/sh
set -e

# QueryBird Docker Entrypoint Script

# Default configuration directory
QB_CONFIG_DIR=${QB_CONFIG_DIR:-/app/.querybird}

# Ensure directories exist
mkdir -p "${QB_CONFIG_DIR}/configs" "${QB_CONFIG_DIR}/secrets" "${QB_CONFIG_DIR}/logs"

# Set proper permissions (in case mounted volumes have different ownership)
if [ "$(id -u)" = "0" ]; then
    # If running as root, fix permissions and switch to querybird user
    chown -R querybird:querybird "${QB_CONFIG_DIR}"
    exec su-exec querybird "$0" "$@"
fi

# Function to check if secrets.json exists and is not empty
check_secrets() {
    local secrets_file="${QB_CONFIG_DIR}/secrets/secrets.json"
    if [ ! -f "$secrets_file" ] || [ ! -s "$secrets_file" ]; then
        echo "⚠️  Warning: No secrets file found at ${secrets_file}"
        echo "📋 To get started:"
        echo "   1. Create secrets: docker-compose run --rm querybird-cli secrets:wizard"
        echo "   2. Or mount your existing secrets directory"
        return 1
    fi
    return 0
}

# Function to check if any job configs exist
check_configs() {
    local configs_dir="${QB_CONFIG_DIR}/configs"
    if [ ! -d "$configs_dir" ] || [ -z "$(ls -A "$configs_dir" 2>/dev/null)" ]; then
        echo "⚠️  Warning: No job configurations found in ${configs_dir}"
        echo "📋 To get started:"
        echo "   1. Create a job: docker-compose run --rm querybird-cli init-postgres"
        echo "   2. Or mount your existing configs directory"
        return 1
    fi
    return 0
}

# Main execution
case "${1:-start}" in
    "start")
        echo "🚀 Starting QueryBird..."
        echo "📁 Config directory: ${QB_CONFIG_DIR}"
        
        # Check for initial setup
        if ! check_secrets || ! check_configs; then
            echo ""
            echo "🔧 QueryBird will start but may not have jobs to run."
            echo "   Use the CLI commands above to set up your first job."
            echo ""
        fi
        
        # Start QueryBird
        exec bun run dist/main-runner.js start --log-level "${LOG_LEVEL:-info}"
        ;;
    
    "health")
        # Health check command
        exec bun run dist/main-runner.js health
        ;;
    
    "version")
        # Version check
        exec bun run dist/main-runner.js --version
        ;;
    
    *)
        # Pass through any other commands
        exec bun run dist/main-runner.js "$@"
        ;;
esac