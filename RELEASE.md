# QueryBird Release Guide

This guide explains how to create and release QueryBird binaries for all platforms with system service support.

## 🚀 Quick Release Process

### 1. Prepare for Release

```bash
# Ensure you're on the main branch and up to date
git checkout main
git pull origin main

# Update version in package.json if needed
# The GitHub workflow will automatically update this during release
```

### 2. Create GitHub Release

1. Go to [GitHub Releases](https://github.com/your-org/querybird/releases)
2. Click "Create a new release"
3. Choose a tag (e.g., `v2.0.0`)
4. Write release notes
5. Publish the release

The GitHub workflow will automatically:

- Build binaries for all platforms (Linux, macOS, Windows)
- Create distribution packages
- Sign binaries (if signing keys are configured)
- Upload everything to the release

### 3. Manual Release (Alternative)

If you prefer to build manually:

```bash
# Build all binaries
bun run build:binaries

# Create distribution packages
bun run build:distribution

# Generate signing keys (first time only)
bun run generate-keys

# Sign all binaries
bun run build:signed

# Check what was created
ls -la dist/releases/
```

## 🔧 Build System Details

### Supported Platforms

| Platform | Architecture | Binary Name                   | Service Type           |
| -------- | ------------ | ----------------------------- | ---------------------- |
| Linux    | x64          | `querybird-linux-x64`         | systemd                |
| Linux    | ARM64        | `querybird-linux-arm64`       | systemd                |
| macOS    | x64          | `querybird-darwin-x64`        | LaunchDaemon           |
| macOS    | ARM64        | `querybird-darwin-arm64`      | LaunchDaemon           |
| Windows  | x64          | `querybird-windows-x64.exe`   | Windows Service (NSSM) |
| Windows  | ARM64        | `querybird-windows-arm64.exe` | Windows Service (NSSM) |

### Build Scripts

- **`scripts/build-binary.ts`** - Builds binaries for all platforms
- **`scripts/sign-binaries.ts`** - Signs binaries with RSA keys
- **`scripts/create-distribution.ts`** - Creates platform-specific packages
- **`scripts/verify-installation.ts`** - Verifies installation integrity

### Distribution Packages

Each release includes:

- **Platform-specific archives**: `querybird-{platform}-{arch}-v{version}.{ext}`
- **Universal archive**: `querybird-v{version}-universal.tar.gz`
- **Install scripts**: `install.sh` (Unix), `install.ps1` (Windows)
- **Setup scripts**: PostgreSQL initialization scripts
- **Service files**: systemd, LaunchDaemon, Windows Service configurations
- **Checksums**: SHA256 hashes for all files
- **Release notes**: Comprehensive installation and usage guide

## 🔐 Binary Signing

### Generate Signing Keys

```bash
# Generate new RSA-4096 key pair
bun run generate-keys

# This creates:
# - keys/querybird-private.pem (keep secret!)
# - keys/querybird-public.pem (distribute with releases)
```

### Sign Binaries

```bash
# Sign all binaries with private key
bun run build:signed

# Verify signatures
bun run scripts/sign-binaries.ts verify-all
```

### GitHub Secrets

For automated signing in GitHub Actions, add these secrets:

- `SIGNING_PRIVATE_KEY`: Your private key content
- `SIGNING_PUBLIC_KEY`: Your public key content

## 📦 Installation Process

### Unix/Linux/macOS

```bash
# One-liner installation
curl -fsSL https://github.com/your-org/querybird/releases/latest/download/install.sh | bash

# Or download and run
wget https://github.com/your-org/querybird/releases/latest/download/install.sh
bash install.sh

# Skip certain steps if needed
bash install.sh --skip-postgres --skip-service
```

### Windows

```powershell
# Download and run
Invoke-WebRequest -Uri "https://github.com/your-org/querybird/releases/latest/download/install.ps1" -OutFile "install.ps1"
.\install.ps1

# Skip certain steps if needed
.\install.ps1 -SkipPostgres -SkipService
```

## 🗄️ PostgreSQL Initialization

The `init-postgres` command is automatically run during installation to:

1. **Create sample configurations** with proper database connection examples
2. **Set up secrets structure** for database credentials
3. **Generate job templates** that users can customize
4. **Ensure proper directory permissions** for security

### Manual PostgreSQL Setup

```bash
# If you need to run it manually
querybird init-postgres --config-dir ~/.querybird/configs --secrets-dir ~/.querybird/secrets
```

## 🖥️ System Service Installation

### Linux (systemd)

```bash
# Service is automatically installed during setup
sudo systemctl start querybird
sudo systemctl enable querybird
sudo systemctl status querybird

# Manual installation
sudo cp dist/binaries/services/querybird.service /etc/systemd/system/
sudo systemctl daemon-reload
sudo systemctl enable querybird
```

### macOS (LaunchDaemon)

```bash
# Service is automatically installed during setup
sudo launchctl start dev.querybird

# Manual installation
sudo cp dist/binaries/services/dev.querybird.plist /Library/LaunchDaemons/
sudo launchctl load /Library/LaunchDaemons/dev.querybird.plist
```

### Windows (NSSM)

```cmd
# Service is automatically installed during setup
nssm start QueryBird

# Manual installation
dist/binaries/services/install-windows-service.bat
```

## 🔍 Verification

### Check Installation

```bash
# Verify everything is working
bun run verify-binary

# Or run manually
querybird --help
querybird init-postgres --help
```

### Check Service Status

```bash
# Linux
sudo systemctl status querybird

# macOS
sudo launchctl list | grep querybird

# Windows
nssm status QueryBird
```

## 📋 Release Checklist

- [ ] Update version in `package.json`
- [ ] Ensure all tests pass: `bun test`
- [ ] Build locally: `bun run build:binaries`
- [ ] Test installation scripts
- [ ] Create GitHub release tag
- [ ] Verify GitHub Actions build succeeds
- [ ] Check all binaries are uploaded
- [ ] Test installation on different platforms
- [ ] Update documentation if needed

## 🐛 Troubleshooting

### Build Issues

```bash
# Clean and rebuild
bun run clean
bun run build:binaries

# Check Bun version
bun --version  # Should be >= 1.0.0
```

### Installation Issues

```bash
# Verify binary integrity
bun run verify-binary

# Check file permissions
ls -la /usr/local/bin/querybird
ls -la ~/.querybird/secrets/  # Should be 700
```

### Service Issues

```bash
# Check service logs
sudo journalctl -u querybird -f  # Linux
sudo log show --predicate 'process == "querybird"' --last 1h  # macOS
```

## 📚 Additional Resources

- [Main README](../README.md) - User documentation
- [Installation Scripts](../install/) - Platform-specific installers
- [GitHub Workflows](../.github/workflows/) - CI/CD configuration
- [Scripts](../scripts/) - Build and utility scripts

## 🤝 Contributing

To contribute to the release process:

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Test the build process
5. Submit a pull request

## 📄 License

This project is licensed under the MIT License - see the [LICENSE](../LICENSE) file for details.
