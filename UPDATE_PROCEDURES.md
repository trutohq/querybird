# QueryBird Update Procedures

This document outlines the proper procedures for updating QueryBird installations.

## Overview

QueryBird v1.0.13+ introduces a new environment variable-based configuration system (`QB_CONFIG_DIR`) to replace the previous command-line argument approach (`--config-dir`, `--secrets-dir`). The installer now handles automatic migration from old configurations.

## Automatic Update Features

### Service Migration
The installer automatically:
1. **Detects existing services** on all platforms (systemd, LaunchDaemon, Windows NSSM)
2. **Stops running services** before update
3. **Removes old service configurations** that use command-line arguments
4. **Creates new services** using `QB_CONFIG_DIR` environment variable
5. **Preserves existing config and secrets** in the same locations

### Cross-Platform Support
- **Linux (systemd)**: Service file updated from `--config-dir` args to `Environment=QB_CONFIG_DIR`
- **macOS (LaunchDaemon)**: Plist updated with `EnvironmentVariables` section
- **Windows (NSSM)**: Service updated with `AppEnvironmentExtra` parameter

## Update Process

### Standard Update (Recommended)
```bash
# Download and run the latest installer
curl -fsSL https://raw.githubusercontent.com/trutohq/querybird/main/install/install.sh | bash
```

The installer will:
1. Download the latest binary
2. Detect and migrate existing service configurations
3. Update service files with new environment variable approach
4. Preserve all existing configs and secrets

### Manual Update Steps (If Needed)

#### Linux (systemd)
```bash
# Stop existing service
sudo systemctl stop querybird

# Run installer
curl -fsSL https://raw.githubusercontent.com/trutohq/querybird/main/install/install.sh | bash

# Start updated service
sudo systemctl start querybird
```

#### macOS (LaunchDaemon)
```bash
# Stop existing service
sudo launchctl unload /Library/LaunchDaemons/dev.querybird.plist

# Run installer
curl -fsSL https://raw.githubusercontent.com/trutohq/querybird/main/install/install.sh | bash

# Start updated service
sudo launchctl start dev.querybird
```

#### Windows (NSSM)
```powershell
# Stop existing service
nssm stop QueryBird

# Run installer
iex ((New-Object System.Net.WebClient).DownloadString('https://raw.githubusercontent.com/trutohq/querybird/main/install/install.ps1'))

# Start updated service
nssm start QueryBird
```

## Verification

After updating, verify the service is using the new configuration:

### Linux
```bash
# Check service status
sudo systemctl status querybird

# Verify environment variable
sudo systemctl show querybird | grep QB_CONFIG_DIR
```

### macOS
```bash
# Check service status  
launchctl print system/dev.querybird

# View logs
tail -f /opt/querybird/logs/querybird.log
```

### Windows
```powershell
# Check service status
nssm status QueryBird

# Check environment variables
nssm get QueryBird AppEnvironmentExtra
```

## Troubleshooting

### Service Still Uses Old Arguments
If you see `--config-dir` arguments after update:

1. **Stop the service manually**
2. **Remove old service configuration**
3. **Re-run the installer**

### Config/Secrets Not Found
The new system looks for configs in:
- Linux/macOS: `/opt/querybird/configs` (or `$QB_CONFIG_DIR/configs`)
- Windows: `C:\\QueryBird\\configs` (or `%QB_CONFIG_DIR%\\configs`)

If configs are in a different location, either:
1. Move them to the standard location
2. Set `QB_CONFIG_DIR` environment variable to point to your custom location

### Version Mismatch
Check binary and service versions:
```bash
# Check binary version
querybird --version

# Check service configuration date
ls -la /etc/systemd/system/querybird.service  # Linux
ls -la /Library/LaunchDaemons/dev.querybird.plist  # macOS
```

## Breaking Changes

### v1.0.13+
- **Removed**: `--config-dir` and `--secrets-dir` command-line options
- **Added**: `QB_CONFIG_DIR` environment variable for path configuration
- **Changed**: Service configurations now use environment variables instead of command arguments

### Migration Path
Old installations using command-line arguments are automatically migrated to use environment variables. No manual intervention required when using the installer script.

## Support

If you encounter issues during update:
1. Check the service logs for specific error messages
2. Verify file permissions on config directories
3. Ensure the binary has execute permissions
4. Report issues at: https://github.com/trutohq/querybird/issues