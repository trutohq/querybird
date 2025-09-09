#!/bin/bash

# QueryBird Docker CLI Wrapper
# This script provides the same CLI experience as the native binary but runs in Docker

set -e

# Default configuration directory
QB_CONFIG_DIR="${QB_CONFIG_DIR:-$HOME/.querybird}"

# Docker image name (can be overridden via environment variable)
QUERYBIRD_IMAGE="${QUERYBIRD_IMAGE:-querybird:latest}"

# Function to ensure config directory exists
ensure_config_dir() {
    mkdir -p "${QB_CONFIG_DIR}/configs" "${QB_CONFIG_DIR}/secrets" "${QB_CONFIG_DIR}/logs"
}

# Function to check if Docker is available
check_docker() {
    if ! command -v docker >/dev/null 2>&1; then
        echo "❌ Error: Docker is not installed or not in PATH"
        echo "📋 Please install Docker: https://docs.docker.com/get-docker/"
        exit 1
    fi
    
    if ! docker info >/dev/null 2>&1; then
        echo "❌ Error: Docker daemon is not running"
        echo "📋 Please start Docker and try again"
        exit 1
    fi
}

# Function to build image if it doesn't exist
ensure_image() {
    if ! docker image inspect "${QUERYBIRD_IMAGE}" >/dev/null 2>&1; then
        echo "🏗️  Building QueryBird Docker image..."
        
        # Try to find Dockerfile in current directory or parent directories
        local dockerfile_dir=""
        local current_dir="$(pwd)"
        
        while [ "$current_dir" != "/" ]; do
            if [ -f "$current_dir/Dockerfile" ] && [ -f "$current_dir/package.json" ]; then
                dockerfile_dir="$current_dir"
                break
            fi
            current_dir="$(dirname "$current_dir")"
        done
        
        if [ -n "$dockerfile_dir" ]; then
            echo "📁 Found QueryBird project in: $dockerfile_dir"
            docker build -t "${QUERYBIRD_IMAGE}" "$dockerfile_dir"
        else
            echo "❌ Error: Could not find QueryBird project with Dockerfile"
            echo "📋 Please run this command from within the QueryBird project directory"
            echo "   Or set QUERYBIRD_IMAGE environment variable to use a pre-built image"
            exit 1
        fi
    fi
}

# Function to run QueryBird in Docker
run_querybird() {
    local docker_args=(
        "--rm"
        "--interactive"
    )
    
    # Add TTY if we're in an interactive terminal
    if [ -t 0 ] && [ -t 1 ]; then
        docker_args+=("--tty")
    fi
    
    # Mount configuration directories
    docker_args+=(
        "--volume" "${QB_CONFIG_DIR}:/app/.querybird"
        "--volume" "$(pwd):/workspace"
        "--workdir" "/workspace"
        "--network" "host"
        "--env" "QB_CONFIG_DIR=/app/.querybird"
    )
    
    # Pass through environment variables that might be useful
    for env_var in LOG_LEVEL NODE_ENV; do
        if [ -n "${!env_var}" ]; then
            docker_args+=("--env" "${env_var}=${!env_var}")
        fi
    done
    
    # Run the container
    docker run "${docker_args[@]}" "${QUERYBIRD_IMAGE}" "$@"
}

# Main execution
main() {
    # Show help for Docker-specific usage
    if [ "$1" = "--docker-help" ]; then
        cat << 'EOF'
QueryBird Docker CLI Wrapper

Environment Variables:
  QB_CONFIG_DIR     Configuration directory (default: ~/.querybird)
  QUERYBIRD_IMAGE   Docker image to use (default: querybird:latest)
  LOG_LEVEL         Log level (debug, info, warn, error)

Examples:
  querybird start                    # Start QueryBird daemon in container
  querybird run-once --job-id test   # Run a specific job
  querybird init-postgres            # Interactive job setup
  querybird config-postgres          # Generate config from existing secrets

Docker Commands:
  docker-compose up querybird        # Start as service
  docker-compose run querybird-cli   # Run CLI commands

For more information, visit: https://github.com/trutohq/querybird
EOF
        exit 0
    fi
    
    # Ensure Docker is available
    check_docker
    
    # Ensure config directory exists
    ensure_config_dir
    
    # Ensure Docker image exists
    ensure_image
    
    # Run QueryBird with all arguments
    run_querybird "$@"
}

# Execute main function with all arguments
main "$@"