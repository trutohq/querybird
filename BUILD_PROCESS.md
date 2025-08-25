# QueryBird Build Process

This document explains the proper build process for QueryBird and how to avoid common asset naming issues.

## Overview

QueryBird builds cross-platform binaries for Linux, macOS (Darwin), and Windows, supporting both x64 and ARM64 architectures. The build process creates consistent, properly named assets that are ready for distribution.

## Asset Naming Convention

All assets follow this consistent naming pattern:

```
querybird-{platform}-{architecture}-v{version}.zip
```

### Supported Platforms and Architectures

| Platform | Architecture | Binary Name                   | Archive Name                             |
| -------- | ------------ | ----------------------------- | ---------------------------------------- |
| Linux    | x64          | `querybird-linux-x64`         | `querybird-linux-x64-v{version}.zip`     |
| Linux    | ARM64        | `querybird-linux-arm64`       | `querybird-linux-arm64-v{version}.zip`   |
| macOS    | x64          | `querybird-darwin-x64`        | `querybird-darwin-x64-v{version}.zip`    |
| macOS    | ARM64        | `querybird-darwin-arm64`      | `querybird-darwin-arm64-v{version}.zip`  |
| Windows  | x64          | `querybird-windows-x64.exe`   | `querybird-windows-x64-v{version}.zip`   |
| Windows  | ARM64        | `querybird-windows-arm64.exe` | `querybird-windows-arm64-v{version}.zip` |

**Important**: We use `darwin` (not `macos`) in binary names to maintain consistency with Node.js/Bun platform naming conventions.

## Build Commands

### Clean Build (Recommended)

```bash
# Clean everything and build fresh
bun run build:distribution
```

### Individual Build Steps

```bash
# Clean existing builds
bun run clean

# Build binaries for all platforms
bun run build:binaries

# Create distribution packages
bun run create-distribution
```

### Signed Builds

```bash
# Build and sign all binaries
bun run build:signed
```

## Asset Management

### Cleaning Assets

```bash
# Clean all build artifacts
bun run clean

# Clean only release assets
bun run clean:releases

# Validate and report on current assets
bun run clean:assets
```

### Asset Validation

The `clean:assets` script performs several checks:

- Identifies duplicate assets
- Validates naming conventions
- Reports asset sizes and counts
- Provides recommendations for clean builds

## Common Issues and Solutions

### Issue: Duplicate Assets

**Symptoms**: Multiple assets for the same platform/architecture/version
**Cause**: Multiple builds without proper cleanup
**Solution**: Always run `bun run clean` before building

### Issue: Inconsistent Naming

**Symptoms**: Assets with names like `macos-apple-silicon` instead of `darwin-arm64`
**Cause**: Manual asset creation or old build processes
**Solution**: Use only the official build scripts

### Issue: Multiple Versions

**Symptoms**: Assets for v1.1.0, v2.0.0, and v2.0.4 mixed together
**Cause**: Building without version management
**Solution**: Set proper version in package.json and clean before building

## GitHub Actions Integration

The GitHub Actions workflow automatically:

1. Cleans existing builds before starting
2. Sets the correct version from tags
3. Builds all platform binaries
4. Signs binaries (if keys are provided)
5. Creates distribution packages
6. Uploads assets to GitHub releases

## Best Practices

1. **Always clean before building**: Use `bun run clean` or `bun run clean:releases`
2. **Use consistent versions**: Ensure package.json version matches your release
3. **Use official scripts**: Don't manually create assets outside of build scripts
4. **Validate assets**: Run `bun run clean:assets` to check for issues
5. **Single source of truth**: Let the build scripts handle all asset creation

## Troubleshooting

### Build Fails

```bash
# Check for existing processes
ps aux | grep querybird

# Clean and retry
bun run clean
bun run build:distribution
```

### Asset Naming Issues

```bash
# Validate current assets
bun run clean:assets

# Clean and rebuild
bun run clean
bun run build:distribution
```

### Version Mismatch

```bash
# Check current version
cat package.json | grep version

# Set correct version
sed -i 's/"version": ".*"/"version": "1.1.0"/' package.json

# Clean and rebuild
bun run clean
bun run build:distribution
```

## File Structure

After a successful build:

```
dist/
├── binaries/                    # Raw binaries and support files
│   ├── querybird-linux-x64     # Linux x64 binary
│   ├── querybird-linux-arm64   # Linux ARM64 binary
│   ├── querybird-darwin-x64    # macOS x64 binary
│   ├── querybird-darwin-arm64  # macOS ARM64 binary
│   ├── querybird-windows-x64.exe # Windows x64 binary
│   ├── querybird-windows-arm64.exe # Windows ARM64 binary
│   ├── install.sh              # Unix/Linux/macOS install script
│   ├── install.ps1             # Windows install script
│   ├── services/               # System service files
│   └── setup/                  # Setup scripts
└── releases/                   # Distribution packages
    ├── querybird-linux-x64-v{version}.zip
    ├── querybird-linux-arm64-v{version}.zip
    ├── querybird-darwin-x64-v{version}.zip
    ├── querybird-darwin-arm64-v{version}.zip
    ├── querybird-windows-x64-v{version}.zip
    ├── querybird-windows-arm64-v{version}.zip
    ├── querybird-v{version}-checksums.txt
    └── querybird-v{version}-release-notes.md
```

## Support

If you encounter build issues:

1. Check this document for common solutions
2. Run `bun run clean:assets` to validate current state
3. Clean and rebuild from scratch
4. Check GitHub Actions logs for automated builds
5. Open an issue with build logs and error messages
