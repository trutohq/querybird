#!/usr/bin/env bun
import { ImprovedSecretsManager, DatabaseConfig } from './improved-secrets-manager';
import { Logger } from './logger';

interface DatabasePrompts {
  name: string;
  host: string;
  port: string;
  database: string;
  user: string;
  password: string;
  ssl: string;
}

/**
 * Interactive secrets collection utility
 */
export class SecretsCollector {
  private secretsManager: ImprovedSecretsManager;
  private logger: Logger;

  constructor(secretsFile: string, encryptionKey?: string) {
    this.secretsManager = new ImprovedSecretsManager(secretsFile, encryptionKey);
    this.logger = new Logger();
  }

  async collectDatabaseSecrets(): Promise<void> {
    console.log('\n🔐 Database Configuration Setup');
    console.log('===============================\n');

    const databases = await this.promptForDatabases();
    
    for (const db of databases) {
      await this.secretsManager.setDatabaseConfig(db.name, {
        host: db.host,
        port: parseInt(db.port, 10),
        database: db.database,
        user: db.user,
        password: db.password,
        ssl: db.ssl === 'yes' || db.ssl === 'true',
        timeout: 30000
      });
      
      this.logger.info(`✓ Saved database config: ${db.name}`);
    }
  }

  async collectApiKeys(): Promise<void> {
    console.log('\n🔑 API Keys Setup');
    console.log('=================\n');

    const apiKeys = await this.promptForApiKeys();
    
    for (const [name, value] of Object.entries(apiKeys)) {
      await this.secretsManager.setSecret(`api_keys.${name}`, value);
      this.logger.info(`✓ Saved API key: ${name}`);
    }
  }

  async collectWebhooks(): Promise<void> {
    console.log('\n🌐 Webhook URLs Setup');
    console.log('=====================\n');

    const webhooks = await this.promptForWebhooks();
    
    for (const [name, url] of Object.entries(webhooks)) {
      await this.secretsManager.setSecret(`webhooks.${name}`, url);
      this.logger.info(`✓ Saved webhook: ${name}`);
    }
  }

  private async promptForDatabases(): Promise<DatabasePrompts[]> {
    const databases: DatabasePrompts[] = [];
    
    // Common database configurations
    const commonDbs = [
      { name: 'production', description: 'Production database' },
      { name: 'staging', description: 'Staging database' },
      { name: 'development', description: 'Development database' },
      { name: 'test', description: 'Test database' },
    ];

    for (const db of commonDbs) {
      const setup = await this.promptYesNo(`Set up ${db.description}?`);
      if (setup) {
        console.log(`\n📊 ${db.description} Configuration:`);
        databases.push({
          name: db.name,
          host: await this.promptInput('Database host', 'localhost'),
          port: await this.promptInput('Database port', '5432'),
          database: await this.promptInput('Database name', db.name),
          user: await this.promptInput('Username', 'postgres'),
          password: await this.promptPassword('Password'),
          ssl: await this.promptInput('Enable SSL? (yes/no)', 'no'),
        });
      }
    }

    // Allow custom database
    const customDb = await this.promptYesNo('Add custom database?');
    if (customDb) {
      console.log('\n🛠️  Custom Database Configuration:');
      databases.push({
        name: await this.promptInput('Database name/identifier'),
        host: await this.promptInput('Database host', 'localhost'),
        port: await this.promptInput('Database port', '5432'),
        database: await this.promptInput('Database name'),
        user: await this.promptInput('Username'),
        password: await this.promptPassword('Password'),
        ssl: await this.promptInput('Enable SSL? (yes/no)', 'no'),
      });
    }

    return databases;
  }

  private async promptForApiKeys(): Promise<Record<string, string>> {
    const apiKeys: Record<string, string> = {};
    
    // Common API keys
    const commonKeys = [
      { name: 'webhook_auth', description: 'Webhook authentication token' },
      { name: 'stripe', description: 'Stripe API key' },
      { name: 'sendgrid', description: 'SendGrid API key' },
      { name: 'slack', description: 'Slack webhook token' },
    ];

    for (const key of commonKeys) {
      const setup = await this.promptYesNo(`Set up ${key.description}?`);
      if (setup) {
        apiKeys[key.name] = await this.promptPassword(`${key.description}`);
      }
    }

    // Allow custom API keys
    while (await this.promptYesNo('Add custom API key?')) {
      const name = await this.promptInput('API key name (e.g., github, aws)');
      const value = await this.promptPassword(`${name} API key`);
      apiKeys[name] = value;
    }

    return apiKeys;
  }

  private async promptForWebhooks(): Promise<Record<string, string>> {
    const webhooks: Record<string, string> = {};
    
    // Common webhooks
    const commonWebhooks = [
      { name: 'test_webhook', description: 'Test webhook URL (e.g., webhook.site)' },
      { name: 'orders_webhook', description: 'Orders webhook URL' },
      { name: 'alerts_webhook', description: 'Alerts webhook URL' },
      { name: 'slack_notifications', description: 'Slack notifications webhook' },
    ];

    for (const webhook of commonWebhooks) {
      const setup = await this.promptYesNo(`Set up ${webhook.description}?`);
      if (setup) {
        const defaultUrl = webhook.name === 'test_webhook' ? 'https://webhook.site/your-unique-url' : 'https://example.com/webhook';
        webhooks[webhook.name] = await this.promptInput(`${webhook.description}`, defaultUrl);
      }
    }

    // Allow custom webhooks
    while (await this.promptYesNo('Add custom webhook?')) {
      const name = await this.promptInput('Webhook name');
      const url = await this.promptInput('Webhook URL', 'https://example.com/webhook');
      webhooks[name] = url;
    }

    return webhooks;
  }

  private async promptInput(question: string, defaultValue = ''): Promise<string> {
    const prompt = defaultValue ? `${question} [${defaultValue}]: ` : `${question}: `;
    process.stdout.write(prompt);
    
    const answer = await this.readInput();
    return answer.trim() || defaultValue;
  }

  private async promptPassword(question: string): Promise<string> {
    process.stdout.write(`${question}: `);
    
    const answer = await this.readInput();
    return answer.trim();
  }

  private async promptYesNo(question: string): Promise<boolean> {
    const answer = await this.promptInput(`${question} (y/n)`, 'n');
    return answer.toLowerCase().startsWith('y');
  }

  private async readInput(): Promise<string> {
    // Improved input reading for Bun
    return new Promise<string>((resolve, reject) => {
      const stdin = process.stdin;
      let data = '';
      
      // Set up stdin for reading
      stdin.setEncoding('utf8');
      if (stdin.setRawMode) {
        stdin.setRawMode(false);
      }
      stdin.resume();
      
      const onData = (chunk: string) => {
        data += chunk;
        if (chunk.includes('\n')) {
          cleanup();
          resolve(data);
        }
      };
      
      const onError = (error: Error) => {
        cleanup();
        reject(error);
      };
      
      const cleanup = () => {
        stdin.pause();
        stdin.removeListener('data', onData);
        stdin.removeListener('error', onError);
      };
      
      stdin.on('data', onData);
      stdin.on('error', onError);
      
      // Timeout after 60 seconds
      setTimeout(() => {
        cleanup();
        reject(new Error('Input timeout'));
      }, 60000);
    });
  }

  async showCurrentSecrets(): Promise<void> {
    console.log('\n📋 Current Secrets:');
    console.log('==================');
    
    try {
      const secrets = await this.secretsManager.listSecrets();
      
      if (secrets.length === 0) {
        console.log('No secrets configured.');
      } else {
        secrets.forEach((secret, index) => {
          console.log(`${index + 1}. ${secret}`);
        });
      }
    } catch (error) {
      console.log('No secrets file found or error reading secrets.');
    }
    console.log('');
  }

  async interactiveSetup(): Promise<void> {
    console.log('🔐 QueryBird Secrets Setup Wizard');
    console.log('==================================\n');
    
    await this.showCurrentSecrets();
    
    if (await this.promptYesNo('Set up database connections?')) {
      await this.collectDatabaseSecrets();
    }
    
    if (await this.promptYesNo('Set up API keys?')) {
      await this.collectApiKeys();
    }
    
    if (await this.promptYesNo('Set up webhook URLs?')) {
      await this.collectWebhooks();
    }
    
    console.log('\n✅ Secrets setup complete!');
    await this.showCurrentSecrets();
  }
}

// CLI interface
async function main(): Promise<void> {
  try {
    const secretsFile = process.env.SECRETS_FILE || './secrets/secrets.json';
    const encryptionKey = process.env.ENCRYPTION_KEY;
    
    const collector = new SecretsCollector(secretsFile, encryptionKey);
    
    const command = process.argv[2];
    
    switch (command) {
      case 'interactive':
      case 'wizard':
        await collector.interactiveSetup();
        break;
        
      case 'database':
      case 'db':
        await collector.collectDatabaseSecrets();
        break;
        
      case 'api-keys':
      case 'keys':
        await collector.collectApiKeys();
        break;
        
      case 'webhooks':
        await collector.collectWebhooks();
        break;
        
      case 'show':
      case 'list':
        await collector.showCurrentSecrets();
        break;
        
      default:
        console.log('QueryBird Secrets Collector');
        console.log('');
        console.log('Commands:');
        console.log('  interactive   Interactive setup wizard');
        console.log('  database      Set up database connections');
        console.log('  api-keys      Set up API keys');
        console.log('  webhooks      Set up webhook URLs');
        console.log('  show          Show current secrets');
        console.log('');
        console.log('Environment variables:');
        console.log('  SECRETS_FILE      Path to secrets file');
        console.log('  ENCRYPTION_KEY    Encryption key for secrets');
        console.log('');
        console.log('Example usage:');
        console.log('  bun run src/utils/secrets-collector.ts wizard');
        console.log('  bun run secrets:wizard');
        break;
    }
  } catch (error) {
    console.error('Error running secrets collector:', error instanceof Error ? error.message : String(error));
    process.exit(1);
  }
}

if (import.meta.main) {
  main().catch(console.error);
}