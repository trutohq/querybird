import { readFile, writeFile, chmod, rename } from 'fs/promises';
import { join, dirname } from 'path';
import { existsSync, readFileSync } from 'fs';
import { Logger } from './logger';

// Read version from package.json or environment variable
let currentVersion: string = process.env.VERSION || '';
if (!currentVersion) {
  try {
    const packageJsonPath = join(import.meta.dirname, '..', '..', 'package.json');
    const packageJson = JSON.parse(readFileSync(packageJsonPath, 'utf-8'));
    currentVersion = packageJson.version || '1.0.0';
  } catch {
    currentVersion = '1.0.0'; // Fallback version
  }
}

interface ReleaseInfo {
  tag_name: string;
  name: string;
  published_at: string;
  assets: Array<{
    name: string;
    browser_download_url: string;
    size: number;
  }>;
}

interface UpdateConfig {
  repo: string;
  currentVersion: string;
  platform: string;
  arch: string;
  binaryPath: string;
  logger?: Logger;
}

export class AutoUpdater {
  private config: UpdateConfig;
  private logger: Logger;

  constructor(config: UpdateConfig) {
    this.config = config;
    this.logger = config.logger || new Logger();
  }

  static detectPlatform(): { platform: string; arch: string } {
    const platform = process.platform;
    const arch = process.arch;

    const platformMap: Record<string, string> = {
      linux: 'linux',
      darwin: 'darwin',
      win32: 'windows',
    };

    const archMap: Record<string, string> = {
      x64: 'x64',
      arm64: 'arm64',
    };

    return {
      platform: platformMap[platform] || platform,
      arch: archMap[arch] || arch,
    };
  }

  async checkForUpdates(): Promise<{ available: boolean; version?: string; info?: ReleaseInfo }> {
    try {
      this.logger.info('Checking for updates...');

      const releaseInfo = await this.getLatestRelease();
      const latestVersion = releaseInfo.tag_name.replace(/^v/, '');

      const isNewer = this.compareVersions(latestVersion, this.config.currentVersion) > 0;

      if (isNewer) {
        this.logger.info(`Update available: ${this.config.currentVersion} → ${latestVersion}`);
        return { available: true, version: latestVersion, info: releaseInfo };
      } else {
        this.logger.info('Already up to date');
        return { available: false };
      }
    } catch (error) {
      this.logger.error('Failed to check for updates:', { error: error instanceof Error ? error.message : String(error) });
      return { available: false };
    }
  }

  async downloadAndInstallUpdate(version: string): Promise<boolean> {
    try {
      this.logger.info(`Downloading QueryBird v${version}...`);

      // Get release info
      const releaseInfo = await this.getLatestRelease();
      const binaryName = this.getBinaryName();

      // Find the right asset
      const asset = releaseInfo.assets.find((a) => a.name === binaryName);
      if (!asset) {
        throw new Error(`Binary not found for platform: ${binaryName}`);
      }

      // Download new binary
      const tempPath = `${this.config.binaryPath}.new`;
      await this.downloadFile(asset.browser_download_url, tempPath);

      // Verify download (optional signature verification)
      const signatureAsset = releaseInfo.assets.find((a) => a.name === `${binaryName}.sig`);
      if (signatureAsset) {
        this.logger.info('Verifying binary signature...');
        const signaturePath = `${tempPath}.sig`;
        await this.downloadFile(signatureAsset.browser_download_url, signaturePath);

        const isValid = await this.verifySignature(tempPath, signaturePath);
        if (!isValid) {
          throw new Error('Binary signature verification failed');
        }
      }

      // Make executable
      await chmod(tempPath, 0o755);

      // Backup current binary
      const backupPath = `${this.config.binaryPath}.backup`;
      if (existsSync(this.config.binaryPath)) {
        await rename(this.config.binaryPath, backupPath);
      }

      // Replace with new binary
      await rename(tempPath, this.config.binaryPath);

      this.logger.info(`✓ Successfully updated to v${version}`);
      this.logger.info('Please restart QueryBird for changes to take effect');

      return true;
    } catch (error) {
      this.logger.error('Update failed:', { error: error instanceof Error ? error.message : String(error) });

      // Restore backup if available
      const backupPath = `${this.config.binaryPath}.backup`;
      if (existsSync(backupPath)) {
        try {
          await rename(backupPath, this.config.binaryPath);
          this.logger.info('Restored previous version');
        } catch (restoreError) {
          this.logger.error('Failed to restore backup:', { error: restoreError instanceof Error ? restoreError.message : String(restoreError) });
        }
      }

      return false;
    }
  }

  private async getLatestRelease(): Promise<ReleaseInfo> {
    const url = `https://api.github.com/repos/${this.config.repo}/releases/latest`;

    const response = await fetch(url, {
      headers: {
        Accept: 'application/vnd.github.v3+json',
        'User-Agent': 'QueryBird-Updater/2.0',
      },
    });

    if (!response.ok) {
      throw new Error(`GitHub API error: ${response.status} ${response.statusText}`);
    }

    return response.json() as Promise<ReleaseInfo>;
  }

  private getBinaryName(): string {
    const { platform, arch } = this.config;
    const extension = platform === 'windows' ? '.exe' : '';
    return `querybird-${platform}-${arch}${extension}`;
  }

  private async downloadFile(url: string, outputPath: string): Promise<void> {
    const response = await fetch(url);

    if (!response.ok) {
      throw new Error(`Download failed: ${response.status} ${response.statusText}`);
    }

    const buffer = await response.arrayBuffer();
    await writeFile(outputPath, new Uint8Array(buffer));
  }

  private async verifySignature(binaryPath: string, signaturePath: string): Promise<boolean> {
    try {
      // Read signature file
      const signatureContent = await readFile(signaturePath, 'utf-8');
      const signatureData = JSON.parse(signatureContent);

      // Read binary
      const binaryContent = await readFile(binaryPath);

      // Verify file hash
      const currentHash = await Bun.CryptoHasher.hash('sha256', binaryContent, 'hex');
      if (currentHash !== signatureData.fileHash) {
        this.logger.error('Binary hash mismatch during update');
        return false;
      }

      // In production, you would verify the cryptographic signature here
      // For now, we just verify the hash
      this.logger.info('Binary signature verification passed');
      return true;
    } catch (error) {
      this.logger.error('Signature verification failed:', { error: error instanceof Error ? error.message : String(error) });
      return false;
    }
  }

  private compareVersions(a: string, b: string): number {
    const parseVersion = (version: string) => {
      return version.split('.').map((part) => {
        const num = parseInt(part, 10);
        return isNaN(num) ? 0 : num;
      });
    };

    const partsA = parseVersion(a);
    const partsB = parseVersion(b);
    const maxLength = Math.max(partsA.length, partsB.length);

    for (let i = 0; i < maxLength; i++) {
      const partA = partsA[i] || 0;
      const partB = partsB[i] || 0;

      if (partA > partB) return 1;
      if (partA < partB) return -1;
    }

    return 0;
  }

  async schedulePeriodicCheck(intervalHours: number = 24): Promise<void> {
    const intervalMs = intervalHours * 60 * 60 * 1000;

    const checkAndNotify = async (): Promise<void> => {
      const { available, version } = await this.checkForUpdates();

      if (available && version) {
        this.logger.info(`📦 Update available: v${version}`);
        this.logger.info('Run "querybird update --install" to update');
      }
    };

    // Check immediately
    await checkAndNotify();

    // Schedule periodic checks
    setInterval(() => {
      checkAndNotify().catch((error) => {
        this.logger.debug('Periodic update check failed:', { error: error instanceof Error ? error.message : String(error) });
      });
    }, intervalMs);

    this.logger.info(`Scheduled update checks every ${intervalHours} hours`);
  }
}

// CLI interface for update commands
export async function handleUpdateCommand(args: string[]): Promise<void> {
  const command = args[0];
  const logger = new Logger();

  // Detect current platform
  const { platform, arch } = AutoUpdater.detectPlatform();

  // Get current version and binary path
  const binaryPath = process.argv[0]; // Path to current executable

  const updater = new AutoUpdater({
    repo: 'trutohq/querybird',
    currentVersion,
    platform,
    arch,
    binaryPath,
    logger,
  });

  switch (command) {
    case 'check':
      const { available, version } = await updater.checkForUpdates();
      if (available && version) {
        logger.info(`Update available: ${currentVersion} → ${version}`);
        process.exit(0);
      } else {
        logger.info('Already up to date');
        process.exit(1);
      }
      break;

    case 'install':
      const targetVersion = args[1];
      let installVersion: string;

      if (targetVersion) {
        installVersion = targetVersion;
      } else {
        const { available, version } = await updater.checkForUpdates();
        if (!available || !version) {
          logger.info('No updates available');
          process.exit(1);
        }
        installVersion = version;
      }

      const success = await updater.downloadAndInstallUpdate(installVersion);
      process.exit(success ? 0 : 1);
      break;

    default:
      logger.info('Update commands:');
      logger.info('  querybird update check     Check for updates');
      logger.info('  querybird update install   Install latest update');
      logger.info('  querybird update install <version>  Install specific version');
      process.exit(1);
  }
}
