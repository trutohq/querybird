#!/usr/bin/env bun
import { Command } from 'commander';
import { JobRunner } from './core/job-runner';
import { ImprovedSecretsManager } from './utils/improved-secrets-manager';
import { Logger, LogLevelName } from './utils/logger';
import { handleUpdateCommand } from './utils/updater';
import { PostgresSetup } from './utils/postgres-setup';
import { getQueryBirdPaths } from './utils/path-resolver';
import { mkdir, access } from 'fs/promises';
import { join } from 'path';
import { fileURLToPath } from 'url';
import { readFileSync } from 'fs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = join(__filename, '..');

// Read version from package.json or environment variable
let VERSION: string = process.env.VERSION || '';
if (!VERSION) {
  try {
    const packageJsonPath = join(__dirname, '..', 'package.json');
    const packageJson = JSON.parse(readFileSync(packageJsonPath, 'utf-8'));
    VERSION = packageJson.version || '1.0.0';
  } catch {
    VERSION = '1.0.0'; // Fallback version
  }
}

const program = new Command();

program.name('querybird').description('QueryBird - Single Instance Job Scheduler').version(VERSION);

// Set version for updater
process.env.VERSION = VERSION;

program
  .command('start')
  .option('--encryption-key <key>', 'Encryption key for file-based secrets')
  .option('--max-concurrent <num>', 'Max concurrent jobs', '10')
  .option('--log-level <level>', 'Log level (debug, info, warn, error)', 'info')
  .description('Start the job scheduler and watch configs')
  .action(async (opts: { encryptionKey?: string; maxConcurrent: string; logLevel: LogLevelName }) => {
    const logger = new Logger(opts.logLevel);

    try {
      // Always use environment-determined paths
      const paths = getQueryBirdPaths();
      const configDir = paths.configs;
      const secretsDir = paths.secrets;

      // Ensure directories exist
      await mkdir(configDir, { recursive: true });
      await mkdir(secretsDir, { recursive: true });
      await mkdir(paths.watermarks, { recursive: true });
      await mkdir(paths.outputs, { recursive: true });

      const runner = new JobRunner({
        configDir: configDir,
        secretsFile: join(secretsDir, 'secrets.json'),
        logger,
        encryptionPassword: opts.encryptionKey,
        maxConcurrentJobs: parseInt(opts.maxConcurrent, 10),
      });

      await runner.start();

      logger.info('QueryBird started successfully');
      logger.info(`Config directory: ${configDir}`);
      logger.info(`Secrets directory: ${secretsDir}`);
      logger.info(`Max concurrent jobs: ${opts.maxConcurrent}`);

      const gracefulShutdown = async (): Promise<void> => {
        logger.info('Shutting down gracefully...');
        await runner.stop();
        process.exit(0);
      };

      process.on('SIGTERM', () => {
        void gracefulShutdown();
      });

      process.on('SIGINT', () => {
        void gracefulShutdown();
      });

      process.stdin.resume();
    } catch (error) {
      logger.error('Failed to start QueryBird:', { error: error instanceof Error ? error.message : String(error) });
      process.exit(1);
    }
  });

program
  .command('run-once')
  .requiredOption('--job-id <id>', 'Job ID to execute')
  .option('--encryption-key <key>', 'Encryption key for file-based secrets')
  .option('--log-level <level>', 'Log level (debug, info, warn, error)', 'info')
  .description('Execute a single job once and exit')
  .action(async (opts: { jobId: string; encryptionKey?: string; logLevel: LogLevelName }) => {
    const logger = new Logger(opts.logLevel);

    try {
      // Always use environment-determined paths
      const paths = getQueryBirdPaths();
      const configDir = paths.configs;
      const secretsDir = paths.secrets;

      const runner = new JobRunner({
        configDir: configDir,
        secretsFile: join(secretsDir, 'secrets.json'),
        logger,
        encryptionPassword: opts.encryptionKey,
      });

      await runner.start();
      const execution = await runner.executeJobOnce(opts.jobId);

      if (execution) {
        if (execution.status === 'completed') {
          logger.info(`Job ${opts.jobId} completed successfully`);
          logger.info(`Duration: ${execution.duration || 0}ms`);
          if (execution.result) {
            logger.info('Result:', execution.result);
          }
        } else {
          logger.error(`Job ${opts.jobId} failed:`, { error: execution.error?.message });
          process.exit(1);
        }
      }

      await runner.stop();
    } catch (error) {
      logger.error('Failed to execute job:', { error: error instanceof Error ? error.message : String(error) });
      process.exit(1);
    }
  });

program
  .command('update')
  .argument('[action]', 'Update action (check, install)')
  .argument('[version]', 'Specific version to install')
  .description('Check for updates or install new version')
  .action(async (action?: string, version?: string) => {
    const args = [action, version].filter((arg): arg is string => Boolean(arg));
    await handleUpdateCommand(args);
  });

program
  .command('init-postgres')
  .option('--encryption-key <key>', 'Encryption key for file-based secrets')
  .description('Interactive setup for PostgreSQL data extraction job')
  .action(async (opts: { encryptionKey?: string }) => {
    const logger = new Logger();

    try {
      // Use consistent path resolution
      const paths = getQueryBirdPaths();

      logger.info(`🌍 Using CONFIG_DIR: ${paths.base}`);
      logger.info(`📁 Config directory: ${paths.configs}`);
      logger.info(`🔒 Secrets directory: ${paths.secrets}`);

      // Ensure directories exist
      await mkdir(paths.configs, { recursive: true });
      await mkdir(paths.secrets, { recursive: true });

      const setup = new PostgresSetup(paths.secretsFile, opts.encryptionKey, logger);

      await setup.initializePostgres(paths.configs, paths.secrets);
    } catch (error) {
      logger.error('Setup failed:', { error: error instanceof Error ? error.message : String(error) });
      process.exit(1);
    }
  });

// Secrets management commands
const secretsCommand = program.command('secrets').description('Manage encrypted secrets');

secretsCommand
  .command('wizard')
  .option('--encryption-key <key>', 'Encryption key for secrets')
  .description('Interactive setup wizard for secrets')
  .action(async (opts: { encryptionKey?: string }) => {
    try {
      const paths = getQueryBirdPaths();
      const { SecretsCollector } = await import('./utils/secrets-collector');
      const collector = new SecretsCollector(paths.secretsFile, opts.encryptionKey);
      await collector.interactiveSetup();
    } catch (error) {
      console.error('Failed to run secrets wizard:', error instanceof Error ? error.message : String(error));
      process.exit(1);
    }
  });

secretsCommand
  .command('set')
  .requiredOption('--path <path>', 'Secret path (e.g. database.production, api_keys.stripe)')
  .requiredOption('--value <value>', 'Secret value (JSON string for complex objects)')
  .option('--encryption-key <key>', 'Encryption key for secrets')
  .description('Store a secret at the specified path')
  .action(async (opts: { path: string; value: string; encryptionKey?: string }) => {
    const logger = new Logger();

    try {
      const paths = getQueryBirdPaths();
      const secretsManager = new ImprovedSecretsManager(paths.secretsFile, opts.encryptionKey);
      await secretsManager.setSecret(opts.path, opts.value);
      logger.info(`✓ Secret stored: ${opts.path}`);
    } catch (error) {
      logger.error('Failed to store secret:', { error: error instanceof Error ? error.message : String(error) });
      process.exit(1);
    }
  });

secretsCommand
  .command('get')
  .requiredOption('--path <path>', 'Secret path to retrieve')
  .option('--encryption-key <key>', 'Encryption key for secrets')
  .description('Retrieve a secret value')
  .action(async (opts: { path: string; encryptionKey?: string }) => {
    const logger = new Logger();

    try {
      const paths = getQueryBirdPaths();
      const secretsManager = new ImprovedSecretsManager(paths.secretsFile, opts.encryptionKey);
      const value = await secretsManager.getSecret(opts.path);

      if (value === undefined) {
        logger.error(`Secret not found: ${opts.path}`);
        process.exit(1);
      }

      console.log(JSON.stringify(value, null, 2));
    } catch (error) {
      logger.error('Failed to retrieve secret:', { error: error instanceof Error ? error.message : String(error) });
      process.exit(1);
    }
  });

secretsCommand
  .command('list')
  .option('--encryption-key <key>', 'Encryption key for secrets')
  .description('List all available secret paths')
  .action(async (opts: { encryptionKey?: string }) => {
    const logger = new Logger();

    try {
      const paths = getQueryBirdPaths();
      const secretsManager = new ImprovedSecretsManager(paths.secretsFile, opts.encryptionKey);
      const secrets = await secretsManager.listSecrets();

      if (secrets.length === 0) {
        logger.info('No secrets configured');
      } else {
        logger.info(`📋 Found ${secrets.length} secrets:`);
        secrets.forEach((secret, index) => {
          console.log(`  ${index + 1}. ${secret}`);
        });
      }
    } catch (error) {
      logger.error('Failed to list secrets:', { error: error instanceof Error ? error.message : String(error) });
      process.exit(1);
    }
  });

secretsCommand
  .command('database')
  .option('--encryption-key <key>', 'Encryption key for secrets')
  .description('Interactive database secrets setup')
  .action(async (opts: { encryptionKey?: string }) => {
    try {
      const paths = getQueryBirdPaths();
      const { SecretsCollector } = await import('./utils/secrets-collector');
      const collector = new SecretsCollector(paths.secretsFile, opts.encryptionKey);
      await collector.collectDatabaseSecrets();
    } catch (error) {
      console.error('Failed to setup database secrets:', error instanceof Error ? error.message : String(error));
      process.exit(1);
    }
  });

secretsCommand
  .command('api-keys')
  .option('--encryption-key <key>', 'Encryption key for secrets')
  .description('Interactive API keys setup')
  .action(async (opts: { encryptionKey?: string }) => {
    try {
      const paths = getQueryBirdPaths();
      const { SecretsCollector } = await import('./utils/secrets-collector');
      const collector = new SecretsCollector(paths.secretsFile, opts.encryptionKey);
      await collector.collectApiKeys();
    } catch (error) {
      console.error('Failed to setup API keys:', error instanceof Error ? error.message : String(error));
      process.exit(1);
    }
  });

secretsCommand
  .command('webhooks')
  .option('--encryption-key <key>', 'Encryption key for secrets')
  .description('Interactive webhooks setup')
  .action(async (opts: { encryptionKey?: string }) => {
    try {
      const paths = getQueryBirdPaths();
      const { SecretsCollector } = await import('./utils/secrets-collector');
      const collector = new SecretsCollector(paths.secretsFile, opts.encryptionKey);
      await collector.collectWebhooks();
    } catch (error) {
      console.error('Failed to setup webhooks:', error instanceof Error ? error.message : String(error));
      process.exit(1);
    }
  });

if (import.meta.main) program.parse();
