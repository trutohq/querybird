#!/usr/bin/env bun
import { mkdir, readdir, stat, access } from 'fs/promises';
import { join, basename } from 'path';

const RAW_VERSION = process.env.VERSION || '2.0.0';
const VERSION = RAW_VERSION.replace(/^v/i, '');
const BINARIES_DIR = join(process.cwd(), 'dist', 'binaries');
const RELEASES_DIR = join(process.cwd(), 'dist', 'releases');

interface PlatformArchive {
  name: string;
  binaryFile: string;
  files: string[];
  archiveType: 'tar.gz' | 'zip';
}

const platforms: PlatformArchive[] = [
  {
    name: 'querybird-linux-x64',
    binaryFile: 'querybird-linux-x64',
    files: ['install.sh', 'setup/setup-postgres.sh', 'services/querybird.service'],
    archiveType: 'zip',
  },
  {
    name: 'querybird-linux-arm64',
    binaryFile: 'querybird-linux-arm64',
    files: ['install.sh', 'setup/setup-postgres.sh', 'services/querybird.service'],
    archiveType: 'zip',
  },
  {
    name: 'querybird-macos-intel',
    binaryFile: 'querybird-darwin-x64',
    files: ['install.sh', 'setup/setup-postgres.sh', 'services/dev.querybird.plist'],
    archiveType: 'zip',
  },
  {
    name: 'querybird-macos-apple-silicon',
    binaryFile: 'querybird-darwin-arm64',
    files: ['install.sh', 'setup/setup-postgres.sh', 'services/dev.querybird.plist'],
    archiveType: 'zip',
  },
  {
    name: 'querybird-windows-x64',
    binaryFile: 'querybird-windows-x64.exe',
    files: ['install.ps1', 'setup/setup-postgres.bat', 'services/install-windows-service.bat'],
    archiveType: 'zip',
  },
  {
    name: 'querybird-windows-arm64',
    binaryFile: 'querybird-windows-arm64.exe',
    files: ['install.ps1', 'setup/setup-postgres.bat', 'services/install-windows-service.bat'],
    archiveType: 'zip',
  },
];

async function createTarGz(platform: PlatformArchive): Promise<void> {
  const archivePath = join(RELEASES_DIR, `${platform.name}-v${VERSION}.tar.gz`);

  try {
    const { execSync } = await import('child_process');
    const cwd = process.cwd();
    process.chdir(BINARIES_DIR);

    execSync(`tar -czf "${archivePath}" ${platform.files.join(' ')}`, { stdio: 'inherit' });

    process.chdir(cwd);
    console.log(`✅ Created ${basename(archivePath)}`);
  } catch (error) {
    console.error(`❌ Failed to create tar.gz for ${platform.name}:`, error);
  }
}

async function createZip(platform: PlatformArchive): Promise<void> {
  const archivePath = join(RELEASES_DIR, `${platform.name}-v${VERSION}.zip`);

  // For simplicity, we'll use a basic zip creation
  // In production, you might want to use a proper zip library
  const { execSync } = await import('child_process');

  try {
    const cwd = process.cwd();
    process.chdir(BINARIES_DIR);

    // Include binary, signature (if exists), public key, and additional files
    const baseFiles = [platform.binaryFile, ...platform.files];
    baseFiles.push(`${platform.binaryFile}.sig`);
    baseFiles.push('querybird-public.pem');

    // Filter to only existing files
    const filesToZip: string[] = [];
    for (const f of baseFiles) {
      try {
        await access(f);
        filesToZip.push(f);
      } catch {
        // ignore missing optional files
      }
    }

    execSync(`zip -r "${archivePath}" ${filesToZip.join(' ')}`, { stdio: 'inherit' });

    process.chdir(cwd);
    console.log(`✅ Created ${basename(archivePath)}`);
  } catch (error) {
    console.error(`❌ Failed to create zip for ${platform.name}:`, error);
  }
}

// Universal archive removed in favor of per-target ZIPs

async function createChecksumsFile(): Promise<void> {
  console.log('🔍 Creating release checksums...');

  const { createHash } = await import('crypto');
  const { readFile, readdir } = await import('fs/promises');

  const releaseFiles = await readdir(RELEASES_DIR);
  const archiveFiles = releaseFiles.filter((f) => f.endsWith('.tar.gz') || f.endsWith('.zip'));

  let checksumsContent = `# QueryBird Release Checksums\n`;
  checksumsContent += `# Version: ${VERSION}\n`;
  checksumsContent += `# Generated: ${new Date().toISOString()}\n\n`;

  for (const file of archiveFiles) {
    const filePath = join(RELEASES_DIR, file);
    const content = await readFile(filePath);
    const hash = createHash('sha256').update(content).digest('hex');
    checksumsContent += `${hash}  ${file}\n`;
  }

  const checksumsPath = join(RELEASES_DIR, `querybird-v${VERSION}-checksums.txt`);
  await import('fs/promises').then((fs) => fs.writeFile(checksumsPath, checksumsContent));

  console.log(`✅ Created release checksums: ${basename(checksumsPath)}`);
}

async function createReleaseNotes(): Promise<void> {
  console.log('📝 Creating release notes...');

  const releaseNotes = `# QueryBird v${VERSION}

## What's New

- Multi-platform binary support (Linux, macOS, Windows)
- System service integration (systemd, LaunchDaemon, Windows Service)
- PostgreSQL initialization before service start
- Enhanced security with binary signing
- Automated installation scripts

## Supported Platforms

- **Linux**: x64, ARM64 (systemd service)
- **macOS**: x64, ARM64 (LaunchDaemon)
- **Windows**: x64, ARM64 (Windows Service via NSSM)

## Quick Start

### 1. Download and Install
\`\`\`bash
# Linux/macOS
curl -fsSL https://github.com/your-org/querybird/releases/latest/download/install.sh | bash

# Windows (PowerShell)
Invoke-WebRequest -Uri "https://github.com/your-org/querybird/releases/latest/download/install.ps1" -OutFile "install.ps1"
.\\install.ps1
\`\`\`

### 2. Initialize PostgreSQL Configuration
\`\`\`bash
querybird init-postgres --config-dir ~/.querybird/configs --secrets-dir ~/.querybird/secrets
\`\`\`

### 3. Start the Service
\`\`\`bash
# Manual start
querybird start --config-dir ~/.querybird/configs

# Or as system service
sudo systemctl start querybird  # Linux
sudo launchctl start dev.querybird  # macOS
\`\`\`

## System Service Installation

### Linux (systemd)
\`\`\`bash
sudo cp dist/binaries/services/querybird.service /etc/systemd/system/
sudo systemctl daemon-reload
sudo systemctl enable querybird
sudo systemctl start querybird
\`\`\`

### macOS (LaunchDaemon)
\`\`\`bash
sudo cp dist/binaries/services/dev.querybird.plist /Library/LaunchDaemons/
sudo launchctl load /Library/LaunchDaemons/dev.querybird.plist
\`\`\`

### Windows (NSSM)
\`\`\`bash
# Install NSSM first, then run:
dist/binaries/services/install-windows-service.bat
\`\`\`

## File Structure

\`\`\`
querybird/
├── configs/          # Job configuration files
├── secrets/          # Encrypted secrets (700 permissions)
├── watermarks/       # Job execution watermarks
├── outputs/          # Job output files
└── logs/            # Service logs
\`\`\`

## Security Features

- **Binary Signing**: RSA-4096 signatures for all binaries
- **Encrypted Secrets**: AES-256-GCM encryption for sensitive data
- **Secure Permissions**: Restricted access to secrets directory
- **Connection Pooling**: Prevents database connection leaks

## Support

- **Documentation**: https://github.com/your-org/querybird#readme
- **Issues**: https://github.com/your-org/querybird/issues
- **Discussions**: https://github.com/your-org/querybird/discussions

---

Generated on ${new Date().toISOString()}
`;

  const releaseNotesPath = join(RELEASES_DIR, `querybird-v${VERSION}-release-notes.md`);
  await import('fs/promises').then((fs) => fs.writeFile(releaseNotesPath, releaseNotes));

  console.log(`✅ Created release notes: ${basename(releaseNotesPath)}`);
}

async function main(): Promise<void> {
  console.log(`🚀 Creating QueryBird v${VERSION} distribution packages...`);

  // Create releases directory
  await mkdir(RELEASES_DIR, { recursive: true });

  // Create platform-specific ZIP archives (all platforms use ZIP)
  for (const platform of platforms) {
    await createZip(platform);
  }

  // Create checksums and release notes
  await createChecksumsFile();
  await createReleaseNotes();

  console.log('\n🎉 Distribution packages created successfully!');
  console.log(`\nFiles available in: ${RELEASES_DIR}`);

  const { readdir } = await import('fs/promises');
  const files = await readdir(RELEASES_DIR);

  console.log('\nCreated packages:');
  for (const file of files) {
    const stats = await stat(join(RELEASES_DIR, file));
    const sizeInMB = (stats.size / (1024 * 1024)).toFixed(2);
    console.log(`  ${file} (${sizeInMB} MB)`);
  }

  console.log('\nNext steps:');
  console.log('1. Review the packages in dist/releases/');
  console.log('2. Create a GitHub release with these files');
  console.log('3. Update the install scripts with the new version');
}

if (import.meta.main) {
  main().catch(console.error);
}
