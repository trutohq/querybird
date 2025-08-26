# QueryBird

Single-instance job scheduler that runs database queries or HTTP calls, transforms data with JSONata, and ships results to outputs (webhooks/HTTP/files/S3).

- Database Support: PostgreSQL, MySQL
- Cron-based scheduling
- Secrets management

Full docs: see [DOCUMENTATION.md](DOCUMENTATION.md).

## Install

### Download and Extract

1. **Download** the zip file for your platform from [Releases](https://github.com/trutohq/querybird/releases):
   - Linux: `querybird-linux-x64-v<version>.zip` or `querybird-linux-arm64-v<version>.zip`
   - macOS: `querybird-darwin-x64-v<version>.zip` or `querybird-darwin-arm64-v<version>.zip`  
   - Windows: `querybird-windows-x64-v<version>.zip` or `querybird-windows-arm64-v<version>.zip`

2. **Extract** the zip file to your desired location

### Linux/macOS Setup

1. **Install binary**:
   ```bash
   sudo cp querybird-<platform>-<arch> /usr/local/bin/querybird
   sudo chmod +x /usr/local/bin/querybird
   ```

2. **Setup PostgreSQL**:
   ```bash
   ./setup/setup-postgres.sh
   ```

3. **Install as system service**:
   ```bash
   # Copy service file
   sudo cp services/querybird.service /etc/systemd/system/  # Linux
   sudo cp services/dev.querybird.plist /Library/LaunchDaemons/  # macOS
   
   # Enable and start
   sudo systemctl enable querybird && sudo systemctl start querybird  # Linux
   sudo launchctl load /Library/LaunchDaemons/dev.querybird.plist  # macOS
   ```

### Windows Setup

1. **Install binary**:
   ```powershell
   # Create directories and copy binary
   New-Item -ItemType Directory -Force -Path 'C:\Program Files\QueryBird'
   Copy-Item querybird-windows-<arch>.exe 'C:\Program Files\QueryBird\querybird.exe'
   ```

2. **Setup PostgreSQL**:
   ```powershell
   .\setup\setup-postgres.bat
   ```

3. **Install as Windows service** (requires [NSSM](https://nssm.cc/)):
   ```powershell
   .\services\install-windows-service.bat
   ```

## Getting Started

After installation, follow these steps:

```bash
# 1. Initialize PostgreSQL configuration (interactive)
querybird init-postgres --config-dir ~/.querybird/configs --secrets-dir ~/.querybird/secrets

# 2. Edit configuration files (optional)
# Edit ~/.querybird/configs/sample.yml to customize your jobs

# 3. Start QueryBird service
sudo systemctl start querybird    # Linux
sudo launchctl start dev.querybird    # macOS

# 4. Check service status
sudo systemctl status querybird    # Linux
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