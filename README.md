# QueryBird

Single-instance job scheduler that runs database queries or HTTP calls, transforms data with JSONata, and ships results to outputs (webhooks/HTTP/files/S3).

- Database Support: PostgreSQL, MySQL
- Cron-based scheduling
- Secrets management

Full docs: see [DOCUMENTATION.md](DOCUMENTATION.md).

## Installation

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
   ```bash
   # Download latest release (replace with actual version)
   wget https://github.com/trutohq/querybird/releases/latest/download/querybird-linux-x64-v<version>.zip
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
   sudo -u querybird querybird init-postgres --config-dir /opt/querybird/configs --secrets-dir /opt/querybird/secrets
   ```

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
   ```bash
   # Download latest release (replace with actual version)
   curl -L -o querybird-darwin-arm64.zip https://github.com/trutohq/querybird/releases/latest/download/querybird-darwin-arm64-v<version>.zip
   unzip querybird-darwin-arm64.zip
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
   querybird init-postgres --config-dir /opt/querybird/configs --secrets-dir /opt/querybird/secrets
   ```

5. **Install as LaunchDaemon**:
   ```bash
   sudo cp services/dev.querybird.plist /Library/LaunchDaemons/
   sudo launchctl load /Library/LaunchDaemons/dev.querybird.plist
   ```

### Service Management
```bash
# Start service
sudo launchctl start dev.querybird

# Stop service  
sudo launchctl stop dev.querybird

# Check if service is loaded
launchctl print system/dev.querybird

# View standard logs
cat /opt/querybird/logs/querybird.log

# View error logs
cat /opt/querybird/logs/querybird.error.log

# Follow error logs in real-time
tail -f /opt/querybird/logs/querybird.error.log

# Unload service (to disable)
sudo launchctl bootout system/dev.querybird

# Reload service (after config changes)
sudo launchctl bootout system/dev.querybird
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
   ```powershell
   # Download latest release (replace with actual version)
   Invoke-WebRequest -Uri "https://github.com/trutohq/querybird/releases/latest/download/querybird-windows-x64-v<version>.zip" -OutFile "querybird-windows-x64.zip"
   Expand-Archive -Path "querybird-windows-x64.zip" -DestinationPath "."
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
   & 'C:\Program Files\QueryBird\querybird.exe' init-postgres --config-dir 'C:\ProgramData\QueryBird\configs' --secrets-dir 'C:\ProgramData\QueryBird\secrets'
   ```

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
# Linux/macOS
querybird init-postgres --config-dir /opt/querybird/configs --secrets-dir /opt/querybird/secrets

# Windows
& 'C:\Program Files\QueryBird\querybird.exe' init-postgres --config-dir 'C:\ProgramData\QueryBird\configs' --secrets-dir 'C:\ProgramData\QueryBird\secrets'
```

This will interactively set up your database connection and create sample job configurations.

## Troubleshooting

### macOS LaunchDaemon Issues

**Issue**: `sudo launchctl load` fails with "Input/output error"

**Solutions**:
1. **Check if Bun is available system-wide**:
   ```bash
   sudo ln -sf ~/.bun/bin/bun /usr/local/bin/bun
   ```

2. **If the service is already loaded**, unload first:
   ```bash
   sudo launchctl bootout system/dev.querybird
   sudo launchctl load /Library/LaunchDaemons/dev.querybird.plist
   ```

3. **Fix PATH issues** by editing `/Library/LaunchDaemons/dev.querybird.plist`:
   ```xml
   <key>EnvironmentVariables</key>
   <dict>
       <key>PATH</key>
       <string>/usr/local/bin:/usr/bin:/bin:/usr/sbin:/sbin</string>
   </dict>
   ```

4. **Check service status**:
   ```bash
   launchctl print system/dev.querybird
   ```

5. **View error logs**:
   ```bash
   cat /opt/querybird/logs/querybird.error.log
   ```

### Common Error Messages

- **"env: bun: No such file or directory"**: Install Bun and create system-wide symlink (see step 1 above)
- **"Bootstrap failed: 5: Input/output error"**: Service may already be loaded, try unloading first
- **"last exit code = 127"**: Command not found - PATH issue (see step 3 above)

## Support

- 📖 [DOCUMENTATION.md](DOCUMENTATION.md)
- 🐛 [Issues](https://github.com/trutohq/querybird/issues)
- 📬 Security: eng@qtruto.one