#!/usr/bin/env bun
import { build } from 'bun';
import { mkdir, writeFile, chmod, access, copyFile, unlink } from 'fs/promises';
import { execSync } from 'child_process';
import { readFileSync } from 'fs';
import { join } from 'path';

interface BuildTarget {
  platform: string;
  arch: string;
  target: string;
  extension: string;
  binaryName: string;
}

// Read version from package.json
const packageJson = JSON.parse(readFileSync(join(process.cwd(), 'package.json'), 'utf8'));
const RAW_VERSION = process.env.VERSION || packageJson.version;
const VERSION = RAW_VERSION.replace(/^v/i, '');
const BUILD_DIR = './dist/binaries';

const targets: BuildTarget[] = [
  { platform: 'linux', arch: 'x64', target: 'bun', extension: '', binaryName: 'querybird-linux-x64' },
  { platform: 'linux', arch: 'arm64', target: 'bun', extension: '', binaryName: 'querybird-linux-arm64' },
  { platform: 'darwin', arch: 'x64', target: 'bun', extension: '', binaryName: 'querybird-darwin-x64' },
  { platform: 'darwin', arch: 'arm64', target: 'bun', extension: '', binaryName: 'querybird-darwin-arm64' },
  { platform: 'windows', arch: 'x64', target: 'bun', extension: '.exe', binaryName: 'querybird-windows-x64.exe' },
  { platform: 'windows', arch: 'arm64', target: 'bun', extension: '.exe', binaryName: 'querybird-windows-arm64.exe' },
];

async function buildBinary(target: BuildTarget): Promise<void> {
  console.log(`Building ${target.binaryName}...`);

  const outputPath = join(BUILD_DIR, target.binaryName);

  try {
    const result = await build({
      entrypoints: ['./src/main-runner.ts'],
      outdir: BUILD_DIR,
      target: target.target as any,
      minify: true,
      sourcemap: 'external',
      define: {
        'process.env.VERSION': JSON.stringify(VERSION),
        'process.env.NODE_ENV': JSON.stringify('production'),
      },
      external: ['pg-native', 'mysql2/lib/auth_plugin'],
    });

    if (result.success) {
      // Rename the output file to the target name
      const defaultOutput = join(BUILD_DIR, 'main-runner.js');
      if (
        await access(defaultOutput)
          .then(() => true)
          .catch(() => false)
      ) {
        await copyFile(defaultOutput, outputPath);
        await unlink(defaultOutput);

        // Make executable on Unix systems
        if (target.platform !== 'windows') {
          await chmod(outputPath, 0o755);
        }
        console.log(`✓ Built ${target.binaryName}`);
      } else {
        console.error(`✗ Build output not found at ${defaultOutput}`);
        process.exit(1);
      }
    } else {
      console.error(`✗ Failed to build ${target.binaryName}`);
      process.exit(1);
    }
  } catch (error) {
    console.error(`✗ Error building ${target.binaryName}:`, error);
    process.exit(1);
  }
}

async function createChecksums(): Promise<void> {
  console.log('Creating checksums...');

  const { createHash } = await import('crypto');
  const { readFile, readdir } = await import('fs/promises');

  const files = await readdir(BUILD_DIR);
  const binaryFiles = files.filter((f) => f.startsWith('querybird-') && !f.endsWith('.sig'));

  let checksumsContent = `# QueryBird Binary Checksums\n`;
  checksumsContent += `# Version: ${VERSION}\n`;
  checksumsContent += `# Generated: ${new Date().toISOString()}\n\n`;

  for (const file of binaryFiles) {
    const filePath = join(BUILD_DIR, file);
    const content = await readFile(filePath);
    const hash = createHash('sha256').update(content).digest('hex');
    checksumsContent += `${hash}  ${file}\n`;
  }

  await writeFile(join(BUILD_DIR, 'CHECKSUMS.txt'), checksumsContent);
  console.log('✓ Created CHECKSUMS.txt');
}

async function createInstallScripts(): Promise<void> {
  console.log('Creating install scripts...');

  // Copy install scripts to binaries directory
  const { copyFile } = await import('fs/promises');

  try {
    await copyFile('./install/install.sh', join(BUILD_DIR, 'install.sh'));
    await copyFile('./install/install.ps1', join(BUILD_DIR, 'install.ps1'));
    await chmod(join(BUILD_DIR, 'install.sh'), 0o755);
    console.log('✓ Created install scripts');
  } catch (error) {
    console.error('✗ Error copying install scripts:', error);
  }
}

async function createServiceFiles(): Promise<void> {
  console.log('Creating system service files...');

  const { writeFile, mkdir } = await import('fs/promises');
  const servicesDir = join(BUILD_DIR, 'services');
  await mkdir(servicesDir, { recursive: true });

  // systemd service file
  const systemdService = `[Unit]
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
`;

  // macOS LaunchDaemon
  const launchDaemon = `<?xml version="1.0" encoding="UTF-8"?>
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
        <string>/opt/querybird/configs</string>
        <string>--log-level</string>
        <string>info</string>
    </array>
    <key>RunAtLoad</key>
    <true/>
    <key>KeepAlive</key>
    <true/>
    <key>StandardOutPath</key>
    <string>/opt/querybird/logs/querybird.log</string>
    <key>StandardErrorPath</key>
    <string>/opt/querybird/logs/querybird.error.log</string>
    <key>WorkingDirectory</key>
    <string>/opt/querybird</string>
</dict>
</plist>
`;

  // Windows Service (using nssm)
  const windowsService = `@echo off
REM QueryBird Windows Service Installation
REM Requires NSSM (Non-Sucking Service Manager)

set SERVICE_NAME=QueryBird
set BINARY_PATH=C:\\Program Files\\QueryBird\\querybird.exe
set CONFIG_DIR=C:\\ProgramData\\QueryBird\\configs

REM Install service using NSSM
nssm install %SERVICE_NAME% "%BINARY_PATH%"
nssm set %SERVICE_NAME% AppParameters "start --config-dir %CONFIG_DIR% --log-level info"
nssm set %SERVICE_NAME% AppDirectory "C:\\ProgramData\\QueryBird"
nssm set %SERVICE_NAME% Description "QueryBird Job Scheduler"
nssm set %SERVICE_NAME% Start SERVICE_AUTO_START

echo QueryBird service installed successfully!
echo Start with: nssm start %SERVICE_NAME%
echo Stop with: nssm stop %SERVICE_NAME%
echo Remove with: nssm remove %SERVICE_NAME% confirm
`;

  await writeFile(join(servicesDir, 'querybird.service'), systemdService);
  await writeFile(join(servicesDir, 'dev.querybird.plist'), launchDaemon);
  await writeFile(join(servicesDir, 'install-windows-service.bat'), windowsService);

  console.log('✓ Created system service files');
}

async function createSetupScripts(): Promise<void> {
  console.log('Creating setup scripts...');

  const { writeFile } = await import('fs/promises');
  const scriptsDir = join(BUILD_DIR, 'setup');
  await mkdir(scriptsDir, { recursive: true });

  // PostgreSQL setup script
  const postgresSetup = `#!/bin/bash
# QueryBird PostgreSQL Setup Script

set -e

CONFIG_DIR="\${CONFIG_DIR:-/opt/querybird}"
SECRETS_DIR="\${SECRETS_DIR:-/opt/querybird/secrets}"

echo "🔧 Setting up QueryBird PostgreSQL configuration..."

# Create directories
mkdir -p "\${CONFIG_DIR}"/{configs,secrets,watermarks,outputs,logs}
chmod 700 "\${SECRETS_DIR}"

# Run init-postgres command using the existing CLI
echo "📊 Initializing PostgreSQL configuration..."
querybird init-postgres --config-dir "\${CONFIG_DIR}/configs" --secrets-dir "\${SECRETS_DIR}"

echo "✅ PostgreSQL setup complete!"
echo "Next steps:"
echo "1. Edit configuration files in \${CONFIG_DIR}/configs"
echo "2. Start the service: querybird start --config-dir \${CONFIG_DIR}/configs"
echo "3. Or install as system service: sudo systemctl enable querybird"
`;

  // Windows setup script
  const windowsSetup = `@echo off
REM QueryBird Windows Setup Script

set CONFIG_DIR=C:\\ProgramData\\QueryBird
set SECRETS_DIR=C:\\ProgramData\\QueryBird\\secrets

echo 🔧 Setting up QueryBird configuration...

REM Create directories
if not exist "%CONFIG_DIR%" mkdir "%CONFIG_DIR%"
if not exist "%CONFIG_DIR%\\configs" mkdir "%CONFIG_DIR%\\configs"
if not exist "%CONFIG_DIR%\\secrets" mkdir "%CONFIG_DIR%\\secrets"
if not exist "%CONFIG_DIR%\\watermarks" mkdir "%CONFIG_DIR%\\watermarks"
if not exist "%CONFIG_DIR%\\outputs" mkdir "%CONFIG_DIR%\\outputs"
if not exist "%CONFIG_DIR%\\logs" mkdir "%CONFIG_DIR%\\logs"

REM Run init-postgres command
echo 📊 Initializing PostgreSQL configuration...
querybird.exe init-postgres --config-dir "%CONFIG_DIR%\\configs" --secrets-dir "%CONFIG_DIR%\\secrets"

echo ✅ Setup complete!
echo Next steps:
echo 1. Edit configuration files in %CONFIG_DIR%\\configs
echo 2. Start the service: querybird.exe start --config-dir %CONFIG_DIR%\\configs
echo 3. Or install as Windows service: install-windows-service.bat
`;

  await writeFile(join(scriptsDir, 'setup-postgres.sh'), postgresSetup);
  await writeFile(join(scriptsDir, 'setup-postgres.bat'), windowsSetup);
  await chmod(join(scriptsDir, 'setup-postgres.sh'), 0o755);

  console.log('✓ Created setup scripts');
}

async function main(): Promise<void> {
  console.log(`🚀 Building QueryBird v${VERSION} for all platforms...`);

  // Create build directory
  await mkdir(BUILD_DIR, { recursive: true });

  // Build for all targets
  for (const target of targets) {
    await buildBinary(target);
  }

  // Create additional files
  await createChecksums();
  await createInstallScripts();
  await createServiceFiles();
  await createSetupScripts();

  console.log('\n🎉 Build complete!');
  console.log(`Binaries available in: ${BUILD_DIR}`);
  console.log('\nFiles created:');
  console.log('- Binary executables for all platforms');
  console.log('- CHECKSUMS.txt with SHA256 hashes');
  console.log('- Install scripts (install.sh, install.ps1)');
  console.log('- System service files (systemd, LaunchDaemon, Windows)');
  console.log('- Setup scripts for PostgreSQL initialization');
}

if (import.meta.main) {
  main().catch(console.error);
}
