# QueryBird

Single-instance job scheduler that runs database queries or HTTP calls, transforms data with JSONata, and ships results to outputs (webhooks/HTTP/files/S3).

- Database Support: PostgreSQL, MySQL
- Cron-based scheduling
- Secrets management

Full docs: see [DOCUMENTATION.md](DOCUMENTATION.md).

## Install

### One-Click Install (Linux/macOS)

```bash
curl -fsSL https://github.com/trutohq/querybird/releases/latest/download/install.sh | bash
```

Automatically downloads, installs, and sets up system service.

### Windows Installation

Windows requires manual setup:

1. **Download**: Get `querybird-windows-x64.exe` or `querybird-windows-arm64.exe` from [Releases](https://github.com/trutohq/querybird/releases)

2. **Install**:
   ```powershell
   # Create directories
   New-Item -ItemType Directory -Force -Path 'C:\Program Files\QueryBird','C:\QueryBird\configs','C:\QueryBird\secrets'
   
   # Copy binary
   Copy-Item .\querybird-windows-<arch>.exe 'C:\Program Files\QueryBird\querybird.exe'
   ```

3. **Setup Service**:
   ```powershell
   # Create and start Windows service
   sc.exe create QueryBird binPath= "C:\Program Files\QueryBird\querybird.exe start --config-dir C:\QueryBird\configs --secrets-dir C:\QueryBird\secrets" start= auto
   sc.exe start QueryBird
   ```

### Manual Download

Download binaries from [Releases](https://github.com/trutohq/querybird/releases):

- Linux: `querybird-linux-x64` or `querybird-linux-arm64`
- macOS: `querybird-darwin-x64` or `querybird-darwin-arm64`  
- Windows: `querybird-windows-x64.exe` or `querybird-windows-arm64.exe`

## Update

```bash
# Check for updates
querybird update check

# Update to latest version
querybird update install
```

## Usage

```bash
# Start QueryBird
querybird start --config-dir ~/.querybird/configs

# Initialize PostgreSQL setup
querybird init-postgres --config-dir ~/.querybird/configs --secrets-dir ~/.querybird/secrets
```

## Service Management

### Linux (systemd)
```bash
sudo systemctl start querybird    # Start
sudo systemctl stop querybird     # Stop
sudo systemctl status querybird   # Status
sudo journalctl -u querybird -f   # Logs
```

### macOS (LaunchDaemon)
```bash
sudo launchctl start dev.querybird   # Start
sudo launchctl stop dev.querybird    # Stop
```

### Windows (Service)
```powershell
sc start QueryBird     # Start
sc stop QueryBird      # Stop
```

## Support

- 📖 [DOCUMENTATION.md](DOCUMENTATION.md)
- 🐛 [Issues](https://github.com/trutohq/querybird/issues)
- 📬 Security: eng@qtruto.one