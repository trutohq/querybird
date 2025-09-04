# QueryBird

Single-instance job scheduler that runs database queries or HTTP calls, transforms data with JSONata, and ships results to outputs (webhooks/HTTP/files/S3).

- Database Support: PostgreSQL, MySQL
- Cron-based scheduling
- Secrets management with hot reloading
- Config hot reloading

Full docs: see [DOCUMENTATION.md](DOCUMENTATION.md).

## Installation

### 🚀 Automatic Installation (Recommended)

**Prerequisites:**

- **Bun runtime** (JavaScript runtime required)

**macOS and Linux:**

```bash
# Install Bun first (if not already installed)
curl -fsSL https://bun.sh/install | bash
source ~/.bashrc  # or restart terminal

# Install QueryBird
curl -fsSL https://github.com/trutohq/querybird/releases/latest/download/install.sh | sudo bash /dev/stdin
```

This script will:

- Detect your platform automatically (macOS/Linux, x64/ARM64)
- Download the latest QueryBird release
- Install the binary to `/usr/local/bin/querybird`
- Set up configuration directories
- Create sample configuration files
- Install system service (LaunchDaemon on macOS, systemd on Linux)
- **Automatically handle permissions** for macOS LaunchDaemon (no manual fixes needed)
- **Note:** Bun must be installed separately as shown above

**After installation, complete the setup:**

1. **Initialize PostgreSQL configuration** (interactive):

   ```bash
   querybird init-postgres
   ```

   📚 **For detailed configuration options, see [DOCUMENTATION.md](DOCUMENTATION.md#configuration)**

2. **Start the service**:

   ```bash
   # macOS
   sudo launchctl start dev.querybird

   # Linux
   sudo systemctl start querybird
   ```

3. **Verify it's running**:

   ```bash
   # macOS - check service status
   sudo launchctl print system/dev.querybird

   # Linux - check service status
   sudo systemctl status querybird
   ```

   **💡 If you get "Could not find service" on macOS, the service may not be loaded. Load it with:**

   ```bash
   sudo launchctl load /Library/LaunchDaemons/dev.querybird.plist
   ```

**To install to a custom directory:**

```bash
curl -fsSL https://github.com/trutohq/querybird/releases/latest/download/install.sh | INSTALL_DIR="$HOME/.local/bin" sudo bash /dev/stdin
```

---

### 📋 Manual Installation

Choose your operating system for detailed installation instructions:

---

## 🐧 Linux Installation (Ubuntu/Debian/CentOS/RHEL)

### Prerequisites

```bash
# Install Bun (JavaScript runtime)
curl -fsSL https://bun.sh/install | bash
source ~/.bashrc  # or restart terminal
```

### Installation Steps

1. **Download and extract**:

   - Go to [Latest Release](https://github.com/trutohq/querybird/releases/latest)
   - Download `querybird-linux-x64-v<version>.zip` (or ARM64 version)
   - Extract the zip file:

   ```bash
   unzip querybird-linux-x64-v<version>.zip
   cd querybird-linux-x64-v<version>
   ```

2. **Install binary**:

   ```bash
   sudo cp querybird-linux-x64 /usr/local/bin/querybird
   sudo chmod +x /usr/local/bin/querybird
   ```

3. **Create QueryBird user and directories**:

   ```bash
   sudo useradd -r -s /bin/false querybird
   sudo mkdir -p /opt/querybird/{configs,secrets,watermarks,outputs,logs}
   sudo chown -R querybird:querybird /opt/querybird
   sudo chmod 700 /opt/querybird/secrets
   ```

4. **Setup PostgreSQL** (interactive configuration):

   ```bash
   sudo -u querybird querybird init-postgres
   ```

   📚 **For detailed configuration options, see [DOCUMENTATION.md](DOCUMENTATION.md#configuration)**

5. **Install as systemd service**:
   ```bash
   sudo cp services/querybird.service /etc/systemd/system/
   sudo systemctl daemon-reload
   sudo systemctl enable querybird
   sudo systemctl start querybird
   ```

### Service Management

```bash
# Start service
sudo systemctl start querybird

# Stop service
sudo systemctl stop querybird

# Restart service
sudo systemctl restart querybird

# Check status
sudo systemctl status querybird

# View logs
sudo journalctl -u querybird -f

# Enable auto-start on boot
sudo systemctl enable querybird
```

---

## 🍎 macOS Installation

### Prerequisites

```bash
# Install Bun (JavaScript runtime)
curl -fsSL https://bun.sh/install | bash

# Create system-wide symlink for LaunchDaemon
sudo ln -sf ~/.bun/bin/bun /usr/local/bin/bun
```

### Installation Steps

1. **Download and extract**:

   - Go to [Latest Release](https://github.com/trutohq/querybird/releases/latest)
   - Download `querybird-darwin-arm64-v<version>.zip` (or x64 version for Intel Macs)
   - Extract the zip file:

   ```bash
   unzip querybird-darwin-arm64-v<version>.zip
   cd querybird-darwin-arm64-v<version>
   ```

2. **Install binary**:

   ```bash
   sudo cp querybird-darwin-arm64 /usr/local/bin/querybird
   sudo chmod +x /usr/local/bin/querybird
   ```

3. **Create directories**:

   ```bash
   sudo mkdir -p /opt/querybird/{configs,secrets,watermarks,outputs,logs}
   sudo chmod 700 /opt/querybird/secrets
   ```

4. **Setup PostgreSQL** (interactive configuration):

   ```bash
   querybird init-postgres
   ```

   📚 **For detailed configuration options, see [DOCUMENTATION.md](DOCUMENTATION.md#configuration)**

5. **Install as LaunchDaemon**:
   ```bash
   sudo cp services/dev.querybird.plist /Library/LaunchDaemons/
   sudo chown root:wheel /Library/LaunchDaemons/dev.querybird.plist
   sudo chmod 644 /Library/LaunchDaemons/dev.querybird.plist
   sudo launchctl load /Library/LaunchDaemons/dev.querybird.plist
   ```

### Service Management

```bash
# Start service
sudo launchctl start dev.querybird

# Stop service
sudo launchctl stop dev.querybird

# Check service status
sudo launchctl print system/dev.querybird

# View standard logs
cat ~/.querybird/logs/querybird.log

# View error logs
cat ~/.querybird/logs/querybird.error.log

# Follow logs in real-time
tail -f ~/.querybird/logs/querybird.log

# Follow error logs in real-time
tail -f ~/.querybird/logs/querybird.error.log

# Load service (if not loaded)
sudo launchctl load /Library/LaunchDaemons/dev.querybird.plist

# Unload service (to disable)
sudo launchctl unload /Library/LaunchDaemons/dev.querybird.plist

# Reload service (after config changes)
sudo launchctl unload /Library/LaunchDaemons/dev.querybird.plist
sudo launchctl load /Library/LaunchDaemons/dev.querybird.plist
```

---

## 🪟 Windows Installation

### Prerequisites

1. **Install NSSM** (Non-Sucking Service Manager):

   - Download from [nssm.cc](https://nssm.cc/download)
   - Extract to `C:\nssm` and add to PATH

2. **Install Node.js/Bun** (JavaScript runtime):
   ```powershell
   # Using winget
   winget install Oven-sh.Bun
   # OR using scoop
   scoop install bun
   ```

### Installation Steps

1. **Download and extract**:

   - Go to [Latest Release](https://github.com/trutohq/querybird/releases/latest)
   - Download `querybird-windows-x64-v<version>.zip` (or ARM64 version)
   - Extract the zip file and navigate to the folder:

   ```powershell
   Expand-Archive -Path "querybird-windows-x64-v<version>.zip" -DestinationPath "."
   cd querybird-windows-x64-v<version>
   ```

2. **Install binary**:

   ```powershell
   # Create directories
   New-Item -ItemType Directory -Force -Path 'C:\Program Files\QueryBird'
   New-Item -ItemType Directory -Force -Path 'C:\ProgramData\QueryBird\configs'
   New-Item -ItemType Directory -Force -Path 'C:\ProgramData\QueryBird\secrets'
   New-Item -ItemType Directory -Force -Path 'C:\ProgramData\QueryBird\watermarks'
   New-Item -ItemType Directory -Force -Path 'C:\ProgramData\QueryBird\outputs'
   New-Item -ItemType Directory -Force -Path 'C:\ProgramData\QueryBird\logs'

   # Copy binary
   Copy-Item querybird-windows-x64.exe 'C:\Program Files\QueryBird\querybird.exe'
   ```

3. **Setup PostgreSQL** (interactive configuration):

   ```powershell
   & 'C:\Program Files\QueryBird\querybird.exe' init-postgres
   ```

   📚 **For detailed configuration options, see [DOCUMENTATION.md](DOCUMENTATION.md#configuration)**

4. **Install as Windows service**:
   ```powershell
   .\services\install-windows-service.bat
   ```

### Service Management

```powershell
# Start service
nssm start QueryBird
# OR
Start-Service QueryBird

# Stop service
nssm stop QueryBird
# OR
Stop-Service QueryBird

# Check service status
nssm status QueryBird
# OR
Get-Service QueryBird

# View service configuration
nssm get QueryBird

# Remove service (if needed)
nssm remove QueryBird confirm
```

---

## 🚀 Getting Started

After installation, initialize PostgreSQL configuration:

```bash
# Linux/macOS/Windows
querybird init-postgres
```

This will interactively set up your database connection and create sample job configurations.

📚 **For database connection templates and examples, see [SECRETS.md](SECRETS.md)**

## 📋 Commands

### Core Commands

#### `querybird start [options]`

Start the job scheduler and watch configs

**Options:**

- `--encryption-key <key>` - Encryption key for file-based secrets
- `--max-concurrent <num>` - Max concurrent jobs (default: 10)
- `--log-level <level>` - Log level: debug, info, warn, error (default: info)
- `--watch-secrets` - Enable hot reloading of secrets file (default: enabled)
- `--no-watch-secrets` - Disable hot reloading of secrets file

**Examples:**

```bash
# Start with default settings (secrets hot reloading enabled)
querybird start

# Start with debug logging and custom concurrency
querybird start --log-level debug --max-concurrent 5

# Start without secrets hot reloading
querybird start --no-watch-secrets

# Start with custom config directory
QB_CONFIG_DIR=/opt/querybird querybird start
```

#### `querybird run-once [options]`

Execute a single job once and exit

**Options:**

- `--job-id <id>` - Job ID to execute (required)
- `--encryption-key <key>` - Encryption key for file-based secrets
- `--log-level <level>` - Log level: debug, info, warn, error (default: info)

**Examples:**

```bash
# Run a specific job once
querybird run-once --job-id my-daily-export

# Run with debug logging
querybird run-once --job-id my-job --log-level debug
```

#### `querybird update [action] [version]`

Check for updates or install new version

**Arguments:**

- `action` - Update action: `check` or `install`
- `version` - Specific version to install (optional)

**Examples:**

```bash
# Check for available updates
querybird update check

# Install latest version
querybird update install

# Install specific version
querybird update install v1.2.3
```

### Setup Commands

#### `querybird init-postgres [options]`

Interactive setup for PostgreSQL data extraction job

**Options:**

- `--encryption-key <key>` - Encryption key for file-based secrets

**What it does:**

- Prompts for job configuration (ID, name, schedule)
- Collects database connection details
- Sets up Balkan ID integration (optional)
- Generates config and secrets files

**Example:**

```bash
querybird init-postgres
```

📚 **For detailed configuration examples and advanced setup, see [DOCUMENTATION.md](DOCUMENTATION.md#configuration)**

#### `querybird init-mysql [options]`

Interactive setup for MySQL data extraction job

**Options:**

- `--encryption-key <key>` - Encryption key for file-based secrets

**Example:**

```bash
querybird init-mysql
```

📚 **For detailed configuration examples and advanced setup, see [DOCUMENTATION.md](DOCUMENTATION.md#configuration)**

#### `querybird config-postgres [options]`

Generate PostgreSQL config from existing secrets

**Options:**

- `--job-id <id>` - Job ID (must match existing secrets key)
- `--encryption-key <key>` - Encryption key for file-based secrets
- `--secrets-file <path>` - Path to external secrets file to import from

**Examples:**

```bash
# Generate config from main secrets file
querybird config-postgres --job-id existing-job

# Import secrets from external file and generate config
querybird config-postgres --job-id my-job --secrets-file /path/to/external-secrets.json

📚 **For external secrets file templates, see [SECRETS.md](SECRETS.md)**
```

#### `querybird config-mysql [options]`

Generate MySQL config from existing secrets

**Options:**

- `--job-id <id>` - Job ID (must match existing secrets key)
- `--encryption-key <key>` - Encryption key for file-based secrets
- `--secrets-file <path>` - Path to external secrets file to import from

**Examples:**

```bash
# Generate config from main secrets file
querybird config-mysql --job-id existing-job

# Import secrets from external file and generate config
querybird config-mysql --job-id my-job --secrets-file /path/to/external-secrets.json

📚 **For external secrets file templates, see [SECRETS.md](SECRETS.md)**
```

### Secrets Management

#### `querybird secrets`

Manage encrypted secrets

**Sub-commands:**

- `wizard` - Interactive setup wizard for secrets
- `set` - Store a secret at the specified path
- `get` - Retrieve a secret value
- `list` - List all available secret paths
- `database` - Interactive database secrets setup
- `api-keys` - Interactive API keys setup
- `webhooks` - Interactive webhooks setup

**Examples:**

```bash
# Interactive secrets wizard
querybird secrets wizard

# Set a specific secret
querybird secrets set --path "myapp.api_key" --value "secret123"

# Get a secret value
querybird secrets get --path "myapp.api_key"

# List all secret paths
querybird secrets list
```

📚 **For detailed secrets management documentation, templates, and examples, see [SECRETS.md](SECRETS.md)**

### Environment Variables

- `QB_CONFIG_DIR` - Base directory for QueryBird files (default: `~/.querybird/`)

### Directory Structure

QueryBird uses the following directory structure:

```
~/.querybird/               # Base directory (configurable)
├── configs/               # Job configuration files (.yml, .yaml, .json)
├── secrets/               # Encrypted secrets storage
├── watermarks/            # Job execution tracking
├── outputs/               # Local file outputs
└── logs/                  # Application logs
```

### Hot Reloading

QueryBird supports hot reloading for both configuration and secrets files:

**Config Hot Reloading** (always enabled):

- Monitors `configs/` directory for `.yml`, `.yaml`, `.json` files
- Automatically reschedules jobs when configs change
- Handles file creation, modification, and deletion

**Secrets Hot Reloading** (enabled by default):

- Monitors `secrets/secrets.json` for changes
- Automatically reloads secrets when file is modified
- Closes existing database connections to force recreation with new credentials
- Validates secrets before applying changes (atomic reload)
- Can be disabled with `--no-watch-secrets` flag

📚 **For secrets management commands and examples, see [SECRETS.md](SECRETS.md)**

**Benefits:**

- No service restart required for config changes
- No service restart required for secrets updates (password changes, API key rotation)
- Graceful handling of connection pool updates

**Safety Features:**

- 500ms debounce to prevent excessive reloads during rapid file changes
- Atomic reload ensures secrets are validated before replacing cache
- Connection pool management prevents credential mismatch
- Error handling preserves service operation if reload fails

## Troubleshooting

### macOS LaunchDaemon Issues

**Issue**: `sudo launchctl print system/dev.querybird` returns "Could not find service"

**Solutions**:

1. **Load the service** (most common solution):

   ```bash
   sudo launchctl load /Library/LaunchDaemons/dev.querybird.plist
   ```

2. **Check if Bun is available system-wide**:

   ```bash
   sudo ln -sf ~/.bun/bin/bun /usr/local/bin/bun
   ```

3. **Fix file permissions** (if loading fails):

   ```bash
   sudo chown root:wheel /Library/LaunchDaemons/dev.querybird.plist
   sudo chmod 644 /Library/LaunchDaemons/dev.querybird.plist
   sudo launchctl load /Library/LaunchDaemons/dev.querybird.plist
   ```

4. **If the service is already loaded**, unload first:

   ```bash
   sudo launchctl unload /Library/LaunchDaemons/dev.querybird.plist
   sudo launchctl load /Library/LaunchDaemons/dev.querybird.plist
   ```

5. **Check service status**:

   ```bash
   sudo launchctl print system/dev.querybird
   ```

6. **View error logs**:

   ```bash
   cat ~/.querybird/logs/querybird.error.log
   ```

### Common Error Messages

- **"Could not find service"**: Service not loaded, run `sudo launchctl load /Library/LaunchDaemons/dev.querybird.plist`
- **"env: bun: No such file or directory"**: Install Bun and create system-wide symlink (see step 2 above)
- **"Bootstrap failed: 5: Input/output error"**: File permission issue (see step 3 above)
- **"last exit code = 127"**: Command not found - PATH issue (see step 2 above)

## 🔄 Updating QueryBird

### Safe Update (Preserves Config and Secrets)

The install script is designed to safely update QueryBird without affecting your existing configurations or secrets.

**Update Command:**

```bash
curl -fsSL https://github.com/trutohq/querybird/releases/latest/download/install.sh | sudo bash /dev/stdin
```

**What the update preserves:**

- ✅ Existing configurations in `~/.querybird/configs/`
- ✅ Existing secrets in `~/.querybird/secrets/`
- ✅ Directory structure and permissions
- ✅ Service configuration
- ✅ **Automatic permission fixes** for macOS LaunchDaemon

**Update Process:**

1. **Stop the service** (if running):

   ```bash
   # macOS
   sudo launchctl stop dev.querybird

   # Linux
   sudo systemctl stop querybird
   ```

2. **Run the install script**:

   ```bash
   curl -fsSL https://github.com/trutohq/querybird/releases/latest/download/install.sh | sudo bash /dev/stdin
   ```

3. **Start the service**:

   ```bash
   # macOS
   sudo launchctl start dev.querybird

   # Linux
   sudo systemctl start querybird
   ```

4. **Verify the update**:
   ```bash
   querybird --version
   ```

The script only creates sample configurations if they don't already exist, ensuring your custom settings remain intact during updates.

---

## Documentation

- 📖 [DOCUMENTATION.md](DOCUMENTATION.md) - Complete feature documentation
- 🔐 [SECRETS.md](SECRETS.md) - Secrets management guide with templates and examples
- 🐛 [Issues](https://github.com/trutohq/querybird/issues) - Bug reports and feature requests
- 📬 Security: eng@qtruto.one
