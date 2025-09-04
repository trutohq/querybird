import { readFile, writeFile, access, mkdir } from 'fs/promises';
import { dirname } from 'path';
import { createHash, randomBytes, createCipheriv, createDecipheriv } from 'crypto';

export interface SecretsConfig {
  database: Record<string, DatabaseConfig>;
  api_keys: Record<string, string>;
  webhooks: Record<string, string>;
  [key: string]: unknown;
}

export interface DatabaseConfig {
  host: string;
  port: number;
  database: string;
  user: string;
  password: string;
  ssl?: boolean;
  timeout?: number;
}

interface EncryptedFile {
  data: string;  // Encrypted JSON
  iv: string;
  tag: string;
  algorithm: string;
  timestamp: string;
}

/**
 * Improved Secrets Manager
 * 
 * Features:
 * - Entire file encryption (not individual values)
 * - Structured JSON values
 * - Interactive database config collection
 * - Type-safe secret access
 */
export class ImprovedSecretsManager {
  private cache: SecretsConfig | null = null;
  private encryptionKey: Buffer | null = null;
  private changeCallbacks: Array<() => void> = [];

  constructor(
    private secretsFile: string = './secrets/secrets.json',
    private encryptionPassword?: string
  ) {
    if (encryptionPassword) {
      this.encryptionKey = this.deriveKey(encryptionPassword);
    }
  }

  private deriveKey(password: string): Buffer {
    return createHash('sha256').update(password).digest();
  }

  private encrypt(text: string): { encrypted: string; iv: string; tag: string } {
    if (!this.encryptionKey) throw new Error('Encryption key not set');
    
    const iv = randomBytes(16);
    const cipher = createCipheriv('aes-256-gcm', this.encryptionKey, iv);
    
    let encrypted = cipher.update(text, 'utf8', 'hex');
    encrypted += cipher.final('hex');
    
    const tag = cipher.getAuthTag();
    
    return {
      encrypted,
      iv: iv.toString('hex'),
      tag: tag.toString('hex')
    };
  }

  private decrypt(encrypted: string, iv: string, tag: string): string {
    if (!this.encryptionKey) throw new Error('Encryption key not set');
    
    const decipher = createDecipheriv('aes-256-gcm', this.encryptionKey, Buffer.from(iv, 'hex'));
    decipher.setAuthTag(Buffer.from(tag, 'hex'));
    
    let decrypted = decipher.update(encrypted, 'hex', 'utf8');
    decrypted += decipher.final('utf8');
    
    return decrypted;
  }

  async loadSecrets(): Promise<SecretsConfig> {
    if (this.cache) {
      return this.cache;
    }

    try {
      await access(this.secretsFile);
    } catch {
      // File doesn't exist, return empty config
      this.cache = {
        database: {},
        api_keys: {},
        webhooks: {}
      };
      return this.cache;
    }

    const content = await readFile(this.secretsFile, 'utf-8');
    
    let secretsData: SecretsConfig;
    
    try {
      if (this.encryptionKey) {
        // File is encrypted
        const encryptedFile = JSON.parse(content) as EncryptedFile;
        const decryptedContent = this.decrypt(encryptedFile.data, encryptedFile.iv, encryptedFile.tag);
        secretsData = JSON.parse(decryptedContent) as SecretsConfig;
      } else {
        // File is plain JSON
        secretsData = JSON.parse(content) as SecretsConfig;
      }
    } catch (error) {
      throw new Error(`Failed to parse secrets file: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }

    this.cache = secretsData;
    return secretsData;
  }

  async saveSecrets(secrets: SecretsConfig): Promise<void> {
    await mkdir(dirname(this.secretsFile), { recursive: true });
    
    const secretsJson = JSON.stringify(secrets, null, 2);
    
    let fileContent: string;
    
    if (this.encryptionKey) {
      // Encrypt entire file
      const { encrypted, iv, tag } = this.encrypt(secretsJson);
      const encryptedFile: EncryptedFile = {
        data: encrypted,
        iv,
        tag,
        algorithm: 'aes-256-gcm',
        timestamp: new Date().toISOString()
      };
      fileContent = JSON.stringify(encryptedFile, null, 2);
    } else {
      fileContent = secretsJson;
    }
    
    await writeFile(this.secretsFile, fileContent);
    this.cache = secrets; // Update cache
  }

  /**
   * Resolve secret reference like "!secrets database.production.host" or "!secrets api_keys.stripe"
   */
  async resolveSecret(secretRef: string): Promise<string> {
    if (!secretRef.startsWith('!secrets ')) {
      return secretRef; // Not a secret reference
    }

    const secretPath = secretRef.substring('!secrets '.length);
    
    // Handle environment variables: !secrets env.DATABASE_URL
    if (secretPath.startsWith('env.')) {
      const envVar = secretPath.substring('env.'.length);
      const value = process.env[envVar];
      if (!value) {
        throw new Error(`Environment variable not found: ${envVar}`);
      }
      return value;
    }

    const secrets = await this.loadSecrets();
    const value = this.getNestedValue(secrets, secretPath);
    
    if (value === undefined || value === null) {
      throw new Error(`Secret not found: ${secretPath}`);
    }
    
    return typeof value === 'string' ? value : JSON.stringify(value);
  }

  async getSecret(path: string): Promise<unknown> {
    const secrets = await this.loadSecrets();
    return this.getNestedValue(secrets, path);
  }

  private getNestedValue(obj: SecretsConfig, path: string): unknown {
    return path.split('.').reduce((current: unknown, key: string) => {
      if (current && typeof current === 'object' && !Array.isArray(current) && key in current) {
        return (current as Record<string, unknown>)[key];
      }
      return undefined;
    }, obj);
  }

  private setNestedValue(obj: SecretsConfig, path: string, value: unknown): void {
    const keys = path.split('.');
    let current: any = obj;
    
    // Navigate to the parent object
    for (let i = 0; i < keys.length - 1; i++) {
      const key = keys[i];
      if (!(key in current) || typeof current[key] !== 'object' || current[key] === null) {
        current[key] = {};
      }
      current = current[key];
    }
    
    const finalKey = keys[keys.length - 1];
    current[finalKey] = value;
  }

  async setSecret(path: string, value: unknown): Promise<void> {
    const secrets = await this.loadSecrets();
    
    // Try to parse value as JSON if it's a string
    let parsedValue = value;
    if (typeof value === 'string') {
      try {
        parsedValue = JSON.parse(value);
      } catch {
        // Keep as string if not valid JSON
        parsedValue = value;
      }
    }
    
    this.setNestedValue(secrets, path, parsedValue);
    await this.saveSecrets(secrets);
  }

  async setDatabaseConfig(name: string, config: DatabaseConfig): Promise<void> {
    const secrets = await this.loadSecrets();
    
    if (!secrets.database) {
      secrets.database = {};
    }
    
    secrets.database[name] = config;
    await this.saveSecrets(secrets);
  }

  async getDatabaseConfig(name: string): Promise<DatabaseConfig | undefined> {
    const secrets = await this.loadSecrets();
    return secrets.database[name];
  }

  async listSecrets(): Promise<string[]> {
    const secrets = await this.loadSecrets();
    return this.flattenKeys(secrets as Record<string, unknown>);
  }

  private flattenKeys(obj: Record<string, unknown>, prefix = ''): string[] {
    const keys: string[] = [];
    
    for (const [key, value] of Object.entries(obj)) {
      const fullKey = prefix ? `${prefix}.${key}` : key;
      
      if (value && typeof value === 'object' && !Array.isArray(value)) {
        // Check if this looks like a final value or a container
        const objKeys = Object.keys(value);
        const isContainer = objKeys.some(k => 
          typeof (value as Record<string, unknown>)[k] === 'object'
        );
        
        if (isContainer) {
          keys.push(...this.flattenKeys(value as Record<string, unknown>, fullKey));
        } else {
          keys.push(fullKey);
        }
      } else {
        keys.push(fullKey);
      }
    }
    
    return keys;
  }

  clearCache(): void {
    this.cache = null;
  }

  /**
   * Add a callback to be invoked when secrets are reloaded
   */
  onSecretsChange(callback: () => void): void {
    this.changeCallbacks.push(callback);
  }

  /**
   * Remove a callback
   */
  removeChangeCallback(callback: () => void): void {
    const index = this.changeCallbacks.indexOf(callback);
    if (index > -1) {
      this.changeCallbacks.splice(index, 1);
    }
  }

  /**
   * Force reload secrets from disk, validate them, and notify callbacks
   * Uses atomic reload pattern: load new secrets first, then replace cache
   */
  async reloadSecrets(): Promise<void> {
    const oldCache = this.cache;
    
    try {
      // Temporarily clear cache to force reload from disk
      this.cache = null;
      
      // Load new secrets (this will validate JSON structure)
      const newSecrets = await this.loadSecrets();
      
      // If we get here, the new secrets are valid
      // The loadSecrets() call above already set this.cache to newSecrets
      
      // Notify all registered callbacks
      this.changeCallbacks.forEach(callback => {
        try {
          callback();
        } catch (error) {
          console.error('Error in secrets change callback:', error);
        }
      });
      
    } catch (error) {
      // Restore old cache if reload failed
      this.cache = oldCache;
      throw new Error(`Failed to reload secrets: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  /**
   * Invalidate cache and trigger reload
   * This is the method that should be called by the SecretsWatcher
   */
  invalidateCache(): void {
    this.cache = null;
  }
}