import { join } from 'path';

/**
 * Centralized path resolution for QueryBird
 * Uses QB_CONFIG_DIR environment variable or falls back to $HOME/.querybird
 * This ensures all components use consistent paths
 */
export function getQueryBirdPaths() {
  const baseConfigDir = process.env.QB_CONFIG_DIR || join(process.env.HOME || process.cwd(), '.querybird');
  return {
    base: baseConfigDir,
    configs: join(baseConfigDir, 'configs'),
    secrets: join(baseConfigDir, 'secrets'),
    watermarks: join(baseConfigDir, 'watermarks'),
    outputs: join(baseConfigDir, 'outputs'),
    logs: join(baseConfigDir, 'logs'),
    secretsFile: join(baseConfigDir, 'secrets', 'secrets.json')
  };
}

/**
 * Get the secrets file path consistently across the application
 */
export function getSecretsFilePath(): string {
  return getQueryBirdPaths().secretsFile;
}