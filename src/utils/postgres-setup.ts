import { writeFile, mkdir } from 'fs/promises';
import { join } from 'path';
import { ImprovedSecretsManager, SecretsConfig } from './improved-secrets-manager';
import { Logger } from './logger';
import YAML from 'yaml';

interface DatabaseConfig {
  name: string;
  host: string;
  port: number;
  database: string;
  user: string;
  password: string;
  region: string;
  ssl: boolean;
}

interface JobConfig {
  id: string;
  name: string;
  description: string;
  schedule: string;
  webhookUrl?: string;
  balkanApiKeys?: {
    keyId: string;
    keySecret: string;
    integrationId: string;
  };
}

export class PostgresSetup {
  private secretsManager: ImprovedSecretsManager;
  private logger: Logger;

  constructor(secretsFile: string, encryptionKey?: string, logger?: Logger) {
    this.logger = logger || new Logger();
    this.secretsManager = new ImprovedSecretsManager(secretsFile, encryptionKey);
  }

  async initializePostgres(configDir: string, secretsDir: string): Promise<void> {
    console.log('🚀 QueryBird PostgreSQL Setup');
    console.log('============================\n');

    console.log('This wizard will help you create a PostgreSQL data extraction job.');
    console.log('You can configure multiple database connections and set up outputs.\n');

    // Step 1: Job Configuration
    const jobConfig = await this.collectJobConfig();

    // Step 2: Database Connections
    const databases = await this.collectDatabaseConnections();

    // Step 3: Output Configuration
    const outputs = await this.collectOutputConfig(jobConfig);

    // Step 4: Generate files
    await this.generateConfigFile(configDir, jobConfig, databases, outputs);
    await this.generateSecretsFile(databases, jobConfig);

    console.log('\n🎉 Setup Complete!');
    console.log(`✅ Config file created: ${join(configDir, jobConfig.id + '.yml')}`);
    console.log(`✅ Secrets file created: secrets/secrets.json`);
    console.log('\n🏃 You can now run your job with:');
    console.log(`   docker-compose run --rm querybird-cli run-once --job-id ${jobConfig.id}`);
  }

  private async collectJobConfig(): Promise<JobConfig> {
    console.log('📋 Job Configuration');
    console.log('===================\n');

    const id = await this.promptForInput('Job ID (e.g., daily-users)', 'string', true);
    const name = await this.promptForInput('Job Name (e.g., Daily User Export)', 'string', true);
    const description = await this.promptForInput('Job Description', 'string', false, 'Export user data from PostgreSQL');
    const schedule = await this.promptForInput('Cron Schedule (e.g., 0 2 * * * for daily at 2 AM)', 'string', false, '0 2 * * *');

    console.log('\n📤 Output Configuration');
    const hasWebhook = await this.promptForConfirmation('Do you want to send data to a webhook?', true);
    let webhookUrl: string | undefined;

    if (hasWebhook) {
      webhookUrl = await this.promptForInput('Webhook URL', 'url', true);
    }

    const hasBalkan = await this.promptForConfirmation('Do you want to upload to Balkan ID?', false);
    let balkanApiKeys: JobConfig['balkanApiKeys'];

    if (hasBalkan) {
      console.log('\n🔑 Balkan ID Configuration');

      const globalSecrets = await this.getGlobalBalkanSecrets();
      if (!globalSecrets.balkan_key_id || !globalSecrets.balkan_key_secret) {
        console.log('Global Balkan API credentials not found. Please configure them:');
        const keyId = await this.promptForInput('Balkan API Key ID', 'string', true);
        const keySecret = await this.promptForInput('Balkan API Key Secret', 'password', true);
        await this.setGlobalBalkanSecrets(keyId, keySecret);
        console.log('✅ Global Balkan credentials saved');
      } else {
        console.log('✅ Using existing global Balkan credentials');
      }

      const integrationId = await this.promptForInput('Balkan Integration ID', 'string', true);
      balkanApiKeys = { keyId: '', keySecret: '', integrationId };
    }

    return {
      id: id.replace(/[^a-z0-9-]/g, '-').toLowerCase(),
      name,
      description,
      schedule,
      webhookUrl,
      balkanApiKeys,
    };
  }

  private async collectDatabaseConnections(): Promise<DatabaseConfig[]> {
    console.log('\n🗄️  Database Connections');
    console.log('======================\n');

    const databases: DatabaseConfig[] = [];
    let addMore = true;

    while (addMore) {
      const dbNumber = databases.length + 1;
      console.log(`📊 Database Connection ${dbNumber}`);

      const name = await this.promptForInput(`Database name/environment (e.g., production, staging)`, 'string', true, databases.length === 0 ? 'production' : undefined);

      const host = await this.promptForInput('Host', 'string', true, 'localhost');
      const portStr = await this.promptForInput('Port', 'number', false, '5432');
      const port = parseInt(portStr, 10);
      const database = await this.promptForInput('Database name', 'string', true);
      const user = await this.promptForInput('Username', 'string', true);
      const password = await this.promptForInput('Password', 'password', true);
      const region = await this.promptForInput('Region', 'string', true, 'default');
      const sslStr = await this.promptForInput('Enable SSL? (y/n)', 'boolean', false, 'y');
      const ssl = sslStr.toLowerCase().startsWith('y');

      databases.push({
        name: name.toLowerCase().replace(/[^a-z0-9_]/g, '_'),
        host,
        port,
        database,
        user,
        password,
        region,
        ssl,
      });

      console.log(''); // Add spacing
      addMore = await this.promptForConfirmation('Add another database connection?', false);

      if (addMore) {
        console.log(''); // Add spacing
      }
    }

    return databases;
  }

  private async collectOutputConfig(jobConfig: JobConfig): Promise<any[]> {
    const outputs: any[] = [];

    // Add webhook output if configured
    if (jobConfig.webhookUrl) {
      outputs.push({
        type: 'webhook',
        endpoint: jobConfig.webhookUrl,
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-QueryBird-Job': jobConfig.id,
        },
        retryCount: 2,
      });
    }

    // Add Balkan ID output if configured
    if (jobConfig.balkanApiKeys) {
      outputs.push({
        type: 'http',
        endpoint: 'https://app.balkan.id/api/rest/v0/entitlements/upload-url',
        method: 'POST',
        headers: {
          'X-Api-Key-ID': `!secrets balkan.balkan_key_id`,
          'X-Api-Key-Secret': `!secrets balkan.balkan_key_secret`,
        },
        body: {
          integrationId: `!secrets ${jobConfig.id}.api_keys.balkan_integration_id`,
        },
        response_url_field: 'url',
        upload_method: 'PUT',
        format: 'csv',
        retryCount: 3,
      });
    }

    return outputs;
  }

  private async generateConfigFile(configDir: string, jobConfig: JobConfig, databases: DatabaseConfig[], outputs: any[]): Promise<void> {
    // Ensure config directory exists
    await mkdir(configDir, { recursive: true });

    // Build input configuration
    const input: any = {};

    if (databases.length > 1) {
      // Multiple database connections
      input.postgres = databases.map((db) => ({
        name: db.name,
        connection_info: `!secrets ${jobConfig.id}.database.${db.name}`,
        sql: [
          {
            name: 'users',
            sql: `SELECT 
            rolname AS username,
            rolsuper AS is_superuser,
            rolcreaterole AS can_create_role,
            rolcreatedb AS can_create_db,
            rolcanlogin AS can_login,
            CURRENT_TIMESTAMP AS last_login_time,
            CURRENT_TIMESTAMP AS last_password_changed_time
          FROM pg_roles
          WHERE rolcanlogin = true;`,
          },
        ],
      }));
    } else {
      // Single database connection - now also requires name field
      const db = databases[0];
      input.postgres = {
        name: db.name,
        connection_info: `!secrets ${jobConfig.id}.database.${db.name}`,
        sql: [
          {
            name: 'users',
            sql: `SELECT 
            rolname AS username,
            rolsuper AS is_superuser,
            rolcreaterole AS can_create_role,
            rolcreatedb AS can_create_db,
            rolcanlogin AS can_login,
            CURRENT_TIMESTAMP AS last_login_time,
            CURRENT_TIMESTAMP AS last_password_changed_time
          FROM pg_roles
          WHERE rolcanlogin = true;`,
          },
        ],
      };
    }

    // Build transform using the same logic as config-from-secrets.ts
    const generateTransform = (databases: Array<{ name: string }>, projectName: string): string => {
      return `(
  $root := $;
  $keys($root).(
    $env := $lookup($root, $);
    ($env.users and $env.connection_info)
    ?
    $env.users.(
      $uname := username;
      $db := $env.connection_info.db_name;
      $reg := $env.connection_info.region;
      $full := $uname & "::" & $db & "::" & $reg;
      $first := $contains($uname, ".") ? $substringBefore($uname, ".") : $uname;
      $last := $contains($uname, ".") ? $substringAfter($uname, ".");

      ([])
        ~> $append(
          is_superuser ? [{
            "Project": "${projectName}",
            "Entity Name": $full,
            "Entity Type": "identity",
            "Entity Source Type": "user",
            "Entity Source ID": $full,
            "Entity Username": $uname,
            "Entity Email": $uname,
            "Entity - Has Access To Name": "Superuser::" & $db & "::" & $reg,
            "Entity - Has Access To Source ID": "superuser-role::" & $db & "::" & $reg,
            "Entity - Has Access To Entity Type": "connection",
            "Entity - Has Access To Source Type": "role",
            "Entity - Has Access To Permission Name": "access",
            "Entity - Has Access To Permission Value": true,
            "Entity Status": (can_login ? "active" : "inactive"),
            "Entity First Name": $first,
            "Entity Last Name": $last ? $last,
            "Entity LastLoginTime": last_login_time,
            "Entity LastPasswordChangedTime": last_password_changed_time,
            "Entity MfaEnabled": false
          }] : []
        )
        ~> $append(
          can_create_role ? [{
            "Project": "${projectName}",
            "Entity Name": $full,
            "Entity Type": "identity",
            "Entity Source Type": "user",
            "Entity Source ID": $full,
            "Entity Username": $uname,
            "Entity Email": $uname,
            "Entity - Has Access To Name": "Create Role::" & $db & "::" & $reg,
            "Entity - Has Access To Source ID": "create-role::" & $db & "::" & $reg,
            "Entity - Has Access To Entity Type": "connection",
            "Entity - Has Access To Source Type": "role",
            "Entity - Has Access To Permission Name": "access",
            "Entity - Has Access To Permission Value": true,
            "Entity Status": (can_login ? "active" : "inactive"),
            "Entity First Name": $first,
            "Entity Last Name": $last ? $last,
            "Entity LastLoginTime": last_login_time,
            "Entity LastPasswordChangedTime": last_password_changed_time,
            "Entity MfaEnabled": false
          }] : []
        )
        ~> $append(
          can_create_db ? [{
            "Project": "${projectName}",
            "Entity Name": $full,
            "Entity Type": "identity",
            "Entity Source Type": "user",
            "Entity Source ID": $full,
            "Entity Username": $uname,
            "Entity Email": $uname,
            "Entity - Has Access To Name": "Create Db::" & $db & "::" & $reg,
            "Entity - Has Access To Source ID": "create-db::" & $db & "::" & $reg,
            "Entity - Has Access To Entity Type": "connection",
            "Entity - Has Access To Source Type": "role",
            "Entity - Has Access To Permission Name": "access",
            "Entity - Has Access To Permission Value": true,
            "Entity Status": (can_login ? "active" : "inactive"),
            "Entity First Name": $first,
            "Entity Last Name": $last ? $last,
            "Entity LastLoginTime": last_login_time,
            "Entity LastPasswordChangedTime": last_password_changed_time,
            "Entity MfaEnabled": false
          }] : []
        )
        ~> $append(
          can_login ? [{
            "Project": "${projectName}",
            "Entity Name": $full,
            "Entity Type": "identity",
            "Entity Source Type": "user",
            "Entity Source ID": $full,
            "Entity Username": $uname,
            "Entity Email": $uname,
            "Entity - Has Access To Name": "Login::" & $db & "::" & $reg,
            "Entity - Has Access To Source ID": "login::" & $db & "::" & $reg,
            "Entity - Has Access To Entity Type": "connection",
            "Entity - Has Access To Source Type": "role",
            "Entity - Has Access To Permission Name": "access",
            "Entity - Has Access To Permission Value": true,
            "Entity Status": (can_login ? "active" : "inactive"),
            "Entity First Name": $first,
            "Entity Last Name": $last ? $last,
            "Entity LastLoginTime": last_login_time,
            "Entity LastPasswordChangedTime": last_password_changed_time,
            "Entity MfaEnabled": false
          }] : []
        )
        ~> $append(
          $not(is_superuser or can_create_role or can_create_db or can_login) ? [{
            "Project": "${projectName}",
            "Entity Name": $full,
            "Entity Type": "identity",
            "Entity Source Type": "user",
            "Entity Source ID": $full,
            "Entity Username": $uname,
            "Entity Email": $uname,
            "Entity - Has Access To Name": "Read::" & $db & "::" & $reg,
            "Entity - Has Access To Source ID": "read::" & $db & "::" & $reg,
            "Entity - Has Access To Entity Type": "connection",
            "Entity - Has Access To Source Type": "role",
            "Entity - Has Access To Permission Name": "access",
            "Entity - Has Access To Permission Value": true,
            "Entity Status": "inactive",
            "Entity First Name": $first,
            "Entity Last Name": $last ? $last,
            "Entity LastLoginTime": last_login_time,
            "Entity LastPasswordChangedTime": last_password_changed_time,
            "Entity MfaEnabled": false
          }] : []
        )
    )
    : []
  )
  ~> $flatten()
)`;
    };

    const transform = generateTransform(databases, jobConfig.name);

    // Build the complete configuration
    const config = {
      id: jobConfig.id,
      name: jobConfig.name,
      description: jobConfig.description,
      input,
      transform,
      schedule: jobConfig.schedule,
      enabled: true,
      outputs,
      timeout: 30000,
    };

    // Write the YAML file
    const configPath = join(configDir, `${jobConfig.id}.yml`);
    const yamlContent = YAML.stringify(config, {
      indent: 2,
      lineWidth: -1,
    });

    await writeFile(configPath, yamlContent);
  }

  private async generateSecretsFile(databases: DatabaseConfig[], jobConfig: JobConfig): Promise<void> {
    // Load existing secrets first
    let existingSecrets: SecretsConfig;
    try {
      existingSecrets = await this.secretsManager.loadSecrets();
    } catch {
      // If no existing secrets file, start with empty structure
      existingSecrets = {
        database: {},
        api_keys: {},
        webhooks: {},
        config: {},
      };
    }

    // Create job-specific section if it doesn't exist
    if (!existingSecrets[jobConfig.id as keyof SecretsConfig]) {
      (existingSecrets as any)[jobConfig.id] = {
        database: {},
        api_keys: {},
        webhooks: {},
      };
    }

    const jobSecrets = (existingSecrets as any)[jobConfig.id];

    // Add database configurations under job_id.database
    if (!jobSecrets.database) jobSecrets.database = {};
    for (const db of databases) {
      jobSecrets.database[db.name] = {
        host: db.host,
        port: db.port,
        database: db.database,
        user: db.user,
        password: db.password,
        region: db.region,
        ssl: db.ssl,
        timeout: 30000,
      };
    }

    // Add API keys under job_id.api_keys
    if (jobConfig.balkanApiKeys) {
      if (!jobSecrets.api_keys) jobSecrets.api_keys = {};
      jobSecrets.api_keys.balkan_integration_id = jobConfig.balkanApiKeys.integrationId;
    }

    // Add webhook URL under job_id.webhooks
    if (jobConfig.webhookUrl) {
      if (!jobSecrets.webhooks) jobSecrets.webhooks = {};
      jobSecrets.webhooks.webhook_url = jobConfig.webhookUrl;
    }

    // Save the merged secrets
    await this.secretsManager.saveSecrets(existingSecrets);
  }

  private async promptForInput(prompt: string, type: 'string' | 'number' | 'password' | 'url' | 'boolean', required: boolean = true, defaultValue?: string): Promise<string> {
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

  private async promptForConfirmation(prompt: string, defaultValue: boolean = false): Promise<boolean> {
    const defaultText = defaultValue ? ' (Y/n)' : ' (y/N)';

    while (true) {
      const input = await this.readInput(`${prompt}${defaultText}: `);
      const value = input.trim().toLowerCase();

      if (!value) {
        return defaultValue;
      }

      if (value === 'y' || value === 'yes') {
        return true;
      }

      if (value === 'n' || value === 'no') {
        return false;
      }

      console.log('❌ Please enter "y" for yes or "n" for no.');
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

  private async getGlobalBalkanSecrets(): Promise<{ balkan_key_id?: string; balkan_key_secret?: string }> {
    try {
      const secrets = await this.secretsManager.loadSecrets();
      const balkanSecrets = (secrets as any).balkan || {};
      return balkanSecrets;
    } catch {
      return {};
    }
  }

  private async setGlobalBalkanSecrets(keyId: string, keySecret: string): Promise<void> {
    let secrets: SecretsConfig;
    try {
      secrets = await this.secretsManager.loadSecrets();
    } catch {
      secrets = {
        database: {},
        api_keys: {},
        webhooks: {},
        config: {},
      };
    }

    if (!(secrets as any).balkan) {
      (secrets as any).balkan = {};
    }

    (secrets as any).balkan.balkan_key_id = keyId;
    (secrets as any).balkan.balkan_key_secret = keySecret;

    await this.secretsManager.saveSecrets(secrets);
  }
}
