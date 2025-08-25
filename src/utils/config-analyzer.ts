import { readFile, readdir } from 'fs/promises';
import { join, extname } from 'path';
import YAML from 'yaml';
import { Logger } from './logger';

export interface SecretReference {
  path: string;
  description: string;
  type: 'database' | 'webhook' | 'api_key' | 'config' | 'unknown';
  configFile: string;
  context: string;
}

export class ConfigAnalyzer {
  private logger: Logger;

  constructor(logger?: Logger) {
    this.logger = logger || new Logger();
  }

  async analyzeConfigs(configDir: string): Promise<SecretReference[]> {
    const secrets: Map<string, SecretReference> = new Map();
    
    try {
      const files = await readdir(configDir);
      const configFiles = files.filter(file => 
        ['.yml', '.yaml'].includes(extname(file).toLowerCase())
      );

      for (const file of configFiles) {
        const filePath = join(configDir, file);
        await this.analyzeConfigFile(filePath, file, secrets);
      }
    } catch (error) {
      this.logger.error(`Failed to analyze config directory: ${configDir}`, { error: error instanceof Error ? error.message : String(error) });
      throw error;
    }

    return Array.from(secrets.values()).sort((a, b) => {
      // Sort by type, then by path
      if (a.type !== b.type) {
        const typeOrder = ['database', 'api_key', 'webhook', 'config', 'unknown'];
        return typeOrder.indexOf(a.type) - typeOrder.indexOf(b.type);
      }
      return a.path.localeCompare(b.path);
    });
  }

  private async analyzeConfigFile(
    filePath: string, 
    fileName: string, 
    secrets: Map<string, SecretReference>
  ): Promise<void> {
    try {
      const content = await readFile(filePath, 'utf-8');
      const config = YAML.parse(content);
      
      this.extractSecretsFromObject(config, '', fileName, secrets);
    } catch (error) {
      this.logger.warn(`Failed to parse config file: ${fileName}`, { error: error instanceof Error ? error.message : String(error) });
    }
  }

  private extractSecretsFromObject(
    obj: unknown, 
    path: string, 
    configFile: string, 
    secrets: Map<string, SecretReference>
  ): void {
    if (typeof obj === 'string' && obj.startsWith('!secrets ')) {
      const secretPath = obj.substring('!secrets '.length);
      const existing = secrets.get(secretPath);
      
      if (!existing) {
        secrets.set(secretPath, {
          path: secretPath,
          description: this.generateDescription(secretPath, path),
          type: this.determineSecretType(secretPath),
          configFile,
          context: path
        });
      }
    } else if (Array.isArray(obj)) {
      obj.forEach((item, index) => {
        this.extractSecretsFromObject(item, `${path}[${index}]`, configFile, secrets);
      });
    } else if (obj && typeof obj === 'object' && !Array.isArray(obj)) {
      Object.entries(obj as Record<string, unknown>).forEach(([key, value]) => {
        const newPath = path ? `${path}.${key}` : key;
        this.extractSecretsFromObject(value, newPath, configFile, secrets);
      });
    }
  }

  private determineSecretType(secretPath: string): SecretReference['type'] {
    const lowerPath = secretPath.toLowerCase();
    
    if (lowerPath.startsWith('database.')) {
      return 'database';
    } else if (lowerPath.startsWith('api_keys.')) {
      return 'api_key';
    } else if (lowerPath.startsWith('webhooks.')) {
      return 'webhook';
    } else if (lowerPath.startsWith('config.')) {
      return 'config';
    }
    
    return 'unknown';
  }

  private generateDescription(secretPath: string, context: string): string {
    const parts = secretPath.split('.');
    const type = this.determineSecretType(secretPath);
    
    switch (type) {
      case 'database':
        return `Database connection for ${parts[1] || 'unknown environment'}`;
      case 'api_key':
        return `API key for ${parts[1] || 'unknown service'}`;
      case 'webhook':
        return `Webhook URL for ${parts[1] || 'unknown endpoint'}`;
      case 'config':
        return `Configuration value: ${parts[1] || 'unknown setting'}`;
      default:
        return `Secret: ${secretPath}`;
    }
  }
}