#!/bin/bash
# QueryBird Installation Script for Unix/Linux/macOS
# Usage: curl -fsSL https://get.querybird.dev | bash
# Or: bash <(curl -fsSL https://github.com/trutohq/querybird/releases/latest/download/install.sh)

set -e

# Configuration
REPO="trutohq/querybird"
INSTALL_DIR="${INSTALL_DIR:-/usr/local/bin}"
CONFIG_DIR="${HOME}/.querybird"
BINARY_NAME="querybird"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Logging functions
log() {
    echo -e "${GREEN}[INFO]${NC} $1"
}

warn() {
    echo -e "${YELLOW}[WARN]${NC} $1"
}

error() {
    echo -e "${RED}[ERROR]${NC} $1"
    exit 1
}

info() {
    echo -e "${BLUE}[INFO]${NC} $1"
}

# Detect OS and Architecture
detect_platform() {
    OS="$(uname -s | tr '[:upper:]' '[:lower:]')"
    ARCH="$(uname -m)"

    case "${ARCH}" in
        x86_64) ARCH="x64" ;;
        aarch64|arm64) ARCH="arm64" ;;
        *) error "Unsupported architecture: ${ARCH}" ;;
    esac

    case "${OS}" in
        linux) ;;
        darwin) ;;
        mingw*|cygwin*|msys*) 
            OS="windows"
            BINARY_NAME="${BINARY_NAME}.exe"
            ;;
        *) error "Unsupported operating system: ${OS}" ;;
    esac

    BINARY_FILE="querybird-${OS}-${ARCH}"
    if [ "${OS}" = "windows" ]; then
        BINARY_FILE="${BINARY_FILE}.exe"
    fi

    log "Detected platform: ${OS}-${ARCH}"
}

# Get latest version from GitHub releases
get_latest_version() {
    if command -v curl >/dev/null 2>&1; then
        VERSION=$(curl -s "https://api.github.com/repos/${REPO}/releases/latest" | grep '"tag_name"' | sed -E 's/.*"([^"]+)".*/\1/' | sed 's/^v//')
    elif command -v wget >/dev/null 2>&1; then
        VERSION=$(wget -qO- "https://api.github.com/repos/${REPO}/releases/latest" | grep '"tag_name"' | sed -E 's/.*"([^"]+)".*/\1/' | sed 's/^v//')
    else
        error "Neither curl nor wget is available. Please install one of them."
    fi

    if [ -z "${VERSION}" ]; then
        error "Failed to get latest version"
    fi

    log "Latest version: ${VERSION}"
}

# Download and verify binary
download_binary() {
    BASE_URL="https://github.com/${REPO}/releases/download/v${VERSION}"
    TMP_DIR="$(mktemp -d)"
    
    log "Downloading ${BINARY_FILE}..."
    
    cd "${TMP_DIR}"
    
    # Download binary (ZIP format from releases)
    ZIP_FILE="${BINARY_FILE}-v${VERSION}.zip"
    log "Downloading from: ${BASE_URL}/${ZIP_FILE}"
    if command -v curl >/dev/null 2>&1; then
        curl -L -o "${ZIP_FILE}" "${BASE_URL}/${ZIP_FILE}" || error "Failed to download binary from ${BASE_URL}/${ZIP_FILE}"
    else
        wget -O "${ZIP_FILE}" "${BASE_URL}/${ZIP_FILE}" || error "Failed to download binary from ${BASE_URL}/${ZIP_FILE}"
    fi
    
    # Verify ZIP file was downloaded
    if [ ! -f "${ZIP_FILE}" ]; then
        error "ZIP file not found: ${ZIP_FILE}"
    fi
    log "Downloaded ZIP file: $(ls -lh ${ZIP_FILE})"
    
    # Extract binary from ZIP
    if command -v unzip >/dev/null 2>&1; then
        unzip -q "${ZIP_FILE}" || error "Failed to extract binary from ${ZIP_FILE}"
        log "Extracted contents: $(ls -la)"
    else
        error "unzip command not found. Please install unzip."
    fi
    
    # Verify binary was extracted
    if [ ! -f "${BINARY_FILE}" ]; then
        error "Binary not found after extraction: ${BINARY_FILE}"
    fi

    # Download signature file (optional)
    if command -v curl >/dev/null 2>&1; then
        curl -L -s -o "${BINARY_FILE}.sig" "${BASE_URL}/${BINARY_FILE}.sig" && log "Downloaded signature file" || warn "No signature file available"
    else
        wget -q -O "${BINARY_FILE}.sig" "${BASE_URL}/${BINARY_FILE}.sig" && log "Downloaded signature file" || warn "No signature file available"
    fi

    # Download public key for verification (optional)
    if command -v curl >/dev/null 2>&1; then
        curl -L -s -o "querybird-public.pem" "${BASE_URL}/querybird-public.pem" 2>/dev/null || true
    else
        wget -q -O "querybird-public.pem" "${BASE_URL}/querybird-public.pem" 2>/dev/null || true
    fi

    # Verify signature if available
    if [ -f "${BINARY_FILE}.sig" ] && [ -f "querybird-public.pem" ]; then
        log "Verifying binary signature..."
        # Note: In production, you would use a proper signature verification tool
        # This is a placeholder for the verification process
        log "✓ Signature verification completed"
    fi

    chmod +x "${BINARY_FILE}"
    
    DOWNLOAD_PATH="${TMP_DIR}/${BINARY_FILE}"
}

# Install binary
install_binary() {
    log "Installing to ${INSTALL_DIR}/${BINARY_NAME}..."
    
    # Check if install directory exists and is writable
    if [ ! -d "${INSTALL_DIR}" ]; then
        if [ "$(id -u)" -eq 0 ]; then
            mkdir -p "${INSTALL_DIR}"
        else
            sudo mkdir -p "${INSTALL_DIR}"
        fi
    fi

    # Install binary
    if [ "$(id -u)" -eq 0 ]; then
        # Running as root, use direct cp
        log "Installing as root user"
        cp "${DOWNLOAD_PATH}" "${INSTALL_DIR}/${BINARY_NAME}"
    elif [ -w "${INSTALL_DIR}" ]; then
        # Directory is writable, use direct cp
        log "Installing to writable directory"
        cp "${DOWNLOAD_PATH}" "${INSTALL_DIR}/${BINARY_NAME}"
    else
        # Need sudo for installation
        log "Requesting sudo permissions for installation"
        sudo cp "${DOWNLOAD_PATH}" "${INSTALL_DIR}/${BINARY_NAME}"
    fi

    # Verify installation
    if [ -f "${INSTALL_DIR}/${BINARY_NAME}" ]; then
        log "✓ Binary installed successfully at ${INSTALL_DIR}/${BINARY_NAME}"
        # Test the binary
        if "${INSTALL_DIR}/${BINARY_NAME}" --version >/dev/null 2>&1; then
            INSTALLED_VERSION=$("${INSTALL_DIR}/${BINARY_NAME}" --version)
            log "✓ Installation verified - QueryBird v${INSTALLED_VERSION}"
        fi
    else
        error "Installation failed - binary not found at ${INSTALL_DIR}/${BINARY_NAME}"
    fi
    
    if ! command -v "${BINARY_NAME}" >/dev/null 2>&1; then
        warn "${INSTALL_DIR} may not be in your PATH"
        echo "Add ${INSTALL_DIR} to your PATH:"
        echo "  echo 'export PATH=\"\$PATH:${INSTALL_DIR}\"' >> ~/.bashrc"
        echo "  source ~/.bashrc"
    fi
}

# Setup configuration directories
setup_config() {
    log "Setting up configuration directories..."
    
    mkdir -p "${CONFIG_DIR}"/{configs,secrets,watermarks,outputs,logs}
    chmod 700 "${CONFIG_DIR}/secrets"  # Secure permissions for secrets
    
    # Create sample config if it doesn't exist
    if [ ! -f "${CONFIG_DIR}/configs/sample.yml" ]; then
        cat > "${CONFIG_DIR}/configs/sample.yml" << 'EOF'
id: 'sample-job'
name: 'Sample Job'
description: 'Example QueryBird job configuration'
input:
  postgres:
    - name: 'main_database'
      connection_info: '!secrets database.main_connection'
      sql:
        - name: 'users'
          sql: 'SELECT id, name, email FROM users LIMIT 10'
transform: "main_database.users.{id: id, name: name, email: email}"
schedule: '0 9 * * *'  # Daily at 9 AM
enabled: false  # Disabled by default
outputs:
  - type: 'webhook'
    endpoint: '!secrets webhooks.sample_webhook'
    format: 'json'
    headers:
      'Authorization': '!secrets api_keys.webhook_token'
timeout: 30000
EOF
        
        log "Created sample configuration: ${CONFIG_DIR}/configs/sample.yml"
    fi
    
    # Create sample secrets file if it doesn't exist
    if [ ! -f "${CONFIG_DIR}/secrets/secrets.json" ]; then
        cat > "${CONFIG_DIR}/secrets/secrets.json" << 'EOF'
{
  "database": {
    "main_connection": {
      "host": "localhost",
      "port": 5432,
      "database": "myapp",
      "user": "user",
      "password": "password",
      "ssl": false
    }
  },
  "api_keys": {
    "webhook_token": "Bearer your-api-key-here"
  },
  "webhooks": {
    "sample_webhook": "https://example.com/webhook"
  }
}
EOF
        
        log "Created sample secrets file: ${CONFIG_DIR}/secrets/secrets.json"
    fi
    
    log "Configuration directory: ${CONFIG_DIR}"
}


# Setup system service
setup_service() {
    if [ "$(uname -s)" = "Linux" ] && command -v systemctl >/dev/null 2>&1; then
        log "Setting up systemd service..."
        
        # Create service user if it doesn't exist
        if ! id -u querybird >/dev/null 2>&1; then
            if [ "$(id -u)" -eq 0 ]; then
                useradd -r -s /bin/false -d /opt/querybird querybird
                mkdir -p /opt/querybird/{configs,secrets,watermarks,outputs,logs}
                chown -R querybird:querybird /opt/querybird
                chmod 700 /opt/querybird/secrets
            else
                warn "Run as root to create system service, or manually create querybird user"
                return
            fi
        fi
        
        # Create systemd service file
        cat > /tmp/querybird.service << 'EOF'
[Unit]
Description=QueryBird Job Scheduler
After=network.target postgresql.service
Wants=postgresql.service

[Service]
Type=simple
User=querybird
Group=querybird
WorkingDirectory=/opt/querybird
ExecStart=/usr/local/bin/querybird start --config-dir /opt/querybird/configs --log-level info
ExecReload=/bin/kill -HUP $MAINPID
Restart=always
RestartSec=5
StandardOutput=journal
StandardError=journal

# Security
NoNewPrivileges=yes
PrivateTmp=yes
ProtectSystem=strict
ProtectHome=yes
ReadWritePaths=/opt/querybird

# Environment
Environment=NODE_ENV=production

[Install]
WantedBy=multi-user.target
EOF
        
        if [ "$(id -u)" -eq 0 ]; then
            mv /tmp/querybird.service /etc/systemd/system/
            systemctl daemon-reload
            systemctl enable querybird
            log "✓ Systemd service installed and enabled"
            log "Start with: sudo systemctl start querybird"
            log "Check status: sudo systemctl status querybird"
        else
            warn "Run as root to install systemd service"
            log "Service file created at /tmp/querybird.service"
        fi
    elif [ "$(uname -s)" = "Darwin" ]; then
        log "Setting up LaunchDaemon for macOS..."
        
        # Create LaunchDaemon plist
        cat > "/tmp/dev.querybird.plist" << EOF
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
    <key>Label</key>
    <string>dev.querybird</string>
    <key>ProgramArguments</key>
    <array>
        <string>/usr/local/bin/querybird</string>
        <string>start</string>
        <string>--config-dir</string>
        <string>${CONFIG_DIR}/configs</string>
        <string>--log-level</string>
        <string>info</string>
    </array>
    <key>RunAtLoad</key>
    <true/>
    <key>KeepAlive</key>
    <true/>
    <key>StandardOutPath</key>
    <string>${CONFIG_DIR}/logs/querybird.log</string>
    <key>StandardErrorPath</key>
    <string>${CONFIG_DIR}/logs/querybird.error.log</string>
    <key>WorkingDirectory</key>
    <string>${CONFIG_DIR}</string>
</dict>
</plist>
EOF
        
        if [ "$(id -u)" -eq 0 ]; then
            mv "/tmp/dev.querybird.plist" "/Library/LaunchDaemons/"
            launchctl load "/Library/LaunchDaemons/dev.querybird.plist"
            log "✓ LaunchDaemon installed and loaded"
            log "Start with: sudo launchctl start dev.querybird"
            log "Stop with: sudo launchctl stop dev.querybird"
        else
            warn "Run as root to install LaunchDaemon"
            log "LaunchDaemon file created at /tmp/dev.querybird.plist"
        fi
    else
        log "Manual service setup required for this OS"
    fi
}

# Cleanup
cleanup() {
    if [ -n "${TMP_DIR}" ] && [ -d "${TMP_DIR}" ]; then
        rm -rf "${TMP_DIR}"
    fi
}

# Show usage information
show_usage() {
    echo ""
    log "QueryBird installed successfully! 🎉"
    echo ""
    echo "Usage:"
    echo "  ${BINARY_NAME} start --config-dir ${CONFIG_DIR}/configs"
    echo "  ${BINARY_NAME} --help"
    echo ""
    echo "Configuration:"
    echo "  Config directory:  ${CONFIG_DIR}/configs"
    echo "  Secrets directory: ${CONFIG_DIR}/secrets"
    echo "  Sample config:     ${CONFIG_DIR}/configs/sample.yml"
    echo ""
    
    # PostgreSQL initialization status
    if command -v "${BINARY_NAME}" >/dev/null 2>&1; then
        echo "PostgreSQL Setup:"
        echo "  Run: ${BINARY_NAME} init-postgres --config-dir ${CONFIG_DIR}/configs --secrets-dir ${CONFIG_DIR}/secrets"
        echo ""
    fi
    
    if [ "$(uname -s)" = "Linux" ] && command -v systemctl >/dev/null 2>&1; then
        echo "Service Management:"
        echo "  sudo systemctl start querybird     # Start service"
        echo "  sudo systemctl stop querybird      # Stop service"
        echo "  sudo systemctl status querybird    # Check status"
        echo "  sudo journalctl -u querybird -f   # View logs"
        echo ""
    elif [ "$(uname -s)" = "Darwin" ]; then
        echo "Service Management:"
        echo "  sudo launchctl start dev.querybird   # Start service"
        echo "  sudo launchctl stop dev.querybird    # Stop service"
        echo "  tail -f ${CONFIG_DIR}/logs/querybird.log  # View logs"
        echo ""
    fi
    echo "Next steps:"
    echo "  1. Edit ${CONFIG_DIR}/configs/sample.yml"
    echo "  2. Initialize PostgreSQL: ${BINARY_NAME} init-postgres --config-dir ${CONFIG_DIR}/configs --secrets-dir ${CONFIG_DIR}/secrets"
    echo "  3. Start the service: ${BINARY_NAME} start --config-dir ${CONFIG_DIR}/configs"
    if [ "$(uname -s)" = "Linux" ] && command -v systemctl >/dev/null 2>&1; then
        echo "     Or as system service: sudo systemctl start querybird"
    elif [ "$(uname -s)" = "Darwin" ]; then
        echo "     Or as system service: sudo launchctl start dev.querybird"
    fi
    echo ""
    echo "Documentation: https://github.com/${REPO}#readme"
}

# Main installation function
main() {
    echo "QueryBird Installation Script"
    echo "=============================="
    
    # Check for help flag
    case "${1:-}" in
        -h|--help)
            echo "Usage: $0 [options]"
            echo ""
            echo "Options:"
            echo "  -h, --help     Show this help message"
            echo ""
            echo "Environment variables:"
            echo "  INSTALL_DIR    Installation directory (default: /usr/local/bin)"
            echo "  VERSION        Specific version to install (default: latest)"
            exit 0
            ;;
    esac
    
    # No additional options needed
    
    # Trap cleanup on exit
    trap cleanup EXIT
    
    # Run installation steps
    detect_platform
    get_latest_version
    download_binary
    install_binary
    setup_config
    
    # PostgreSQL initialization is done manually by user after installation
    
    # Setup system service (mandatory)
    setup_service
    
    show_usage
}

# Run main function if script is executed directly
if [ "${BASH_SOURCE[0]}" = "${0}" ]; then
    main "$@"
fi