# QueryBird

Single-instance job scheduler that runs database queries or HTTP calls, transforms data with JSONata, and ships results to outputs (webhooks/HTTP/files/S3).

- Database Support: PostgreSQL, MySQL
- Cron-based scheduling
- Secrets management

Full docs: see [DOCUMENTATION.md](DOCUMENTATION.md).

## Download

Grab binaries from Releases for your OS/CPU:

- Linux: `querybird-linux-x64` or `querybird-linux-arm64`
- macOS: `querybird-darwin-x64` or `querybird-darwin-arm64`
- Windows: `querybird-windows-x64.exe` or `querybird-windows-arm64.exe`

## OS Quickstart: Install + Run as a Service

### Linux (systemd)

```bash
sudo install -m 0755 ./querybird-linux-<arch> /usr/local/bin/querybird
sudo mkdir -p /etc/querybird/{configs,secrets}
# sudo cp -r ./configs/* /etc/querybird/configs/

sudo cp dist/binaries/services/querybird.service /etc/systemd/system/querybird.service
sudo systemctl daemon-reload
sudo systemctl enable --now querybird

# Logs
journalctl -u querybird -f
```

Service command (edit in unit if needed):

```ini
ExecStart=/usr/local/bin/querybird start --config-dir /etc/querybird/configs --secrets-dir /etc/querybird/secrets --log-level info
```

### macOS (LaunchDaemon)

```bash
sudo install -m 0755 ./querybird-darwin-<arch> /usr/local/bin/querybird
sudo mkdir -p /etc/querybird/{configs,secrets}

sudo cp dist/binaries/services/dev.querybird.plist /Library/LaunchDaemons/dev.querybird.plist
sudo launchctl load -w /Library/LaunchDaemons/dev.querybird.plist
```

To restart:

```bash
sudo launchctl unload /Library/LaunchDaemons/dev.querybird.plist
sudo launchctl load -w /Library/LaunchDaemons/dev.querybird.plist
```

### Windows (Service)

```powershell
New-Item -ItemType Directory -Force -Path 'C:\\Program Files\\QueryBird','C:\\QueryBird\\configs','C:\\QueryBird\\secrets' | Out-Null
Copy-Item .\querybird-windows-<arch>.exe 'C:\\Program Files\\QueryBird\\querybird.exe'

# From release folder
services\install-windows-service.bat
# Or manually
sc.exe create QueryBird binPath= "C:\\Program Files\\QueryBird\\querybird.exe start --config-dir C:\\QueryBird\\configs --secrets-dir C:\\QueryBird\\secrets" start= auto
sc.exe start QueryBird
```

## Support

- 📖 See [DOCUMENTATION.md](DOCUMENTATION.md)
- 🐛 Issues: GitHub Issues
- 📬 Security: security@querybird.dev
