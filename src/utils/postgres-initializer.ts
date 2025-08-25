import { readFile } from 'fs/promises';
import { ImprovedSecretsManager, SecretsConfig } from './improved-secrets-manager';
import { ConfigAnalyzer, type SecretReference } from './config-analyzer';
import { Logger } from './logger';

interface DatabaseConnection {
  host: string;
  port: number;
  database: string;
  user: string;
  password: string;
  ssl: boolean;
  timeout: number;
}

interface InitializationOptions {
  configDir: string;
  secretsFile: string;
  encryptionPassword?: string;
  logger?: Logger;
}

export class PostgresInitializer {
  private analyzer: ConfigAnalyzer;
  private secretsManager: ImprovedSecretsManager;
  private logger: Logger;

  constructor(options: InitializationOptions) {
    this.logger = options.logger || new Logger();
    this.analyzer = new ConfigAnalyzer(this.logger);
    this.secretsManager = new ImprovedSecretsManager(
      options.secretsFile,
      options.encryptionPassword
    );
  }

  async initialize(configDir: string): Promise<void> {
    console.log('🔍 Analyzing configuration files...');
    
    // Analyze configs to find all secret references
    const secrets = await this.analyzer.analyzeConfigs(configDir);
    
    if (secrets.length === 0) {
      console.log('✅ No secrets found in configuration files.');
      return;
    }

    console.log(`\n📋 Found ${secrets.length} secrets to configure:\n`);

    // Display all secrets that will be configured
    secrets.forEach((secret, index) => {
      console.log(`${index + 1}. ${secret.path}`);
      console.log(`   ${secret.description}`);
      console.log(`   Used in: ${secret.configFile}\n`);
    });

    console.log('🚀 Starting interactive setup...\n');

    // Build secrets configuration
    const secretsConfig: SecretsConfig = {
      database: {},
      api_keys: {},
      webhooks: {},
      config: {}
    };

    // Group secrets by type for better organization
    const secretsByType = this.groupSecretsByType(secrets);

    // Collect database connections
    if (secretsByType.database.length > 0) {
      console.log('🗄️  Database Connections:\n');
      for (const secret of secretsByType.database) {
        const dbConfig = await this.collectDatabaseConfig(secret);
        this.setNestedValue(secretsConfig, secret.path, dbConfig);
      }
    }

    // Collect API keys
    if (secretsByType.api_key.length > 0) {
      console.log('🔑 API Keys:\n');
      for (const secret of secretsByType.api_key) {
        const apiKey = await this.promptForInput(secret.description, 'string', true);
        this.setNestedValue(secretsConfig, secret.path, apiKey);
      }
    }

    // Collect webhooks
    if (secretsByType.webhook.length > 0) {
      console.log('🔗 Webhook URLs:\n');
      for (const secret of secretsByType.webhook) {
        const webhookUrl = await this.promptForInput(secret.description, 'url');
        this.setNestedValue(secretsConfig, secret.path, webhookUrl);
      }
    }

    // Collect config values
    if (secretsByType.config.length > 0) {
      console.log('⚙️  Configuration Values:\n');
      for (const secret of secretsByType.config) {
        const configValue = await this.promptForInput(secret.description, 'string');
        this.setNestedValue(secretsConfig, secret.path, configValue);
      }
    }

    // Handle unknown secrets
    if (secretsByType.unknown.length > 0) {
      console.log('❓ Other Secrets:\n');
      for (const secret of secretsByType.unknown) {
        const value = await this.promptForInput(secret.description, 'string');
        this.setNestedValue(secretsConfig, secret.path, value);
      }
    }

    // Save the secrets configuration
    console.log('\n💾 Saving secrets configuration...');
    await this.secretsManager.saveSecrets(secretsConfig);
    console.log('✅ Secrets configuration saved successfully!');
    
    console.log('\n🎉 Initialization complete!');
    console.log('You can now run your QueryBird jobs with the configured secrets.');
  }

  private groupSecretsByType(secrets: SecretReference[]): Record<string, SecretReference[]> {
    return secrets.reduce((groups, secret) => {
      if (!groups[secret.type]) {
        groups[secret.type] = [];
      }
      groups[secret.type].push(secret);
      return groups;
    }, {} as Record<string, SecretReference[]>);
  }

  private async collectDatabaseConfig(secret: SecretReference): Promise<DatabaseConnection> {
    const dbName = secret.path.split('.')[1] || 'database';
    
    console.log(`📊 Configuring database: ${dbName}`);
    console.log(`   ${secret.description}\n`);

    const host = await this.promptForInput('Database host', 'string');
    const portStr = await this.promptForInput('Database port', 'number', false, '5432');
    const port = parseInt(portStr, 10);
    const database = await this.promptForInput('Database name', 'string');
    const user = await this.promptForInput('Database user', 'string');
    const password = await this.promptForInput('Database password', 'password', true);
    const sslStr = await this.promptForInput('Enable SSL? (y/n)', 'boolean', false, 'n');
    const ssl = sslStr.toLowerCase().startsWith('y');

    console.log(''); // Add spacing

    return {
      host,
      port,
      database,
      user,
      password,
      ssl,
      timeout: 30000
    };
  }

  private async promptForInput(
    prompt: string, 
    type: 'string' | 'number' | 'password' | 'url' | 'boolean',
    required: boolean = true,
    defaultValue?: string
  ): Promise<string> {
    const defaultText = defaultValue ? ` (default: ${defaultValue})` : '';
    const requiredText = required ? ' (required)' : ' (optional)';
    
    while (true) {
      const input = await this.readInput(`${prompt}${defaultText}${requiredText}: `);
      const value = input.trim() || defaultValue || '';

      if (required && !value) {
        console.log('❌ This field is required. Please enter a value.');
        continue;
      }

      if (!value) {
        return '';
      }

      // Validate based on type
      if (type === 'number' && isNaN(parseInt(value, 10))) {
        console.log('❌ Please enter a valid number.');
        continue;
      }

      if (type === 'url' && value && !this.isValidUrl(value)) {
        console.log('❌ Please enter a valid URL (e.g., https://example.com).');
        continue;
      }

      return value;
    }
  }

  private isValidUrl(url: string): boolean {
    try {
      new URL(url);
      return true;
    } catch {
      return false;
    }
  }

  private async readInput(prompt: string): Promise<string> {
    process.stdout.write(prompt);
    
    return new Promise((resolve) => {
      const stdin = process.stdin;
      stdin.setEncoding('utf8');
      stdin.resume();
      
      const onData = (data: string) => {
        stdin.pause();
        stdin.off('data', onData);
        resolve(data.toString().trim());
      };
      
      stdin.on('data', onData);
    });
  }

  private setNestedValue(obj: any, path: string, value: any): void {
    const parts = path.split('.');
    let current = obj;

    for (let i = 0; i < parts.length - 1; i++) {
      const part = parts[i];
      if (!(part in current) || typeof current[part] !== 'object') {
        current[part] = {};
      }
      current = current[part];
    }

    current[parts[parts.length - 1]] = value;
  }
}