import { writeFile, mkdir } from 'fs/promises';
import { join } from 'path';
import { ImprovedSecretsManager, SecretsConfig } from './improved-secrets-manager';
import { Logger } from './logger';
import YAML from 'yaml';

interface JobMetadata {
  name: string;
  description: string;
  schedule: string;
}

export class ConfigFromSecrets {
  private secretsManager: ImprovedSecretsManager;
  private logger: Logger;

  constructor(secretsFile: string, encryptionKey?: string, logger?: Logger) {
    this.logger = logger || new Logger();
    this.secretsManager = new ImprovedSecretsManager(secretsFile, encryptionKey);
  }

  async generatePostgresConfig(configDir: string, jobId: string, externalSecretsFile?: string): Promise<void> {
    await this.generateConfig(configDir, jobId, 'postgres', externalSecretsFile);
  }

  async generateMysqlConfig(configDir: string, jobId: string, externalSecretsFile?: string): Promise<void> {
    await this.generateConfig(configDir, jobId, 'mysql', externalSecretsFile);
  }

  private async generateConfig(configDir: string, jobId: string, dbType: 'postgres' | 'mysql', externalSecretsFile?: string): Promise<void> {
    // Load existing secrets
    let secrets = await this.secretsManager.loadSecrets();

    // If external secrets file is provided, merge the job-specific secrets from it
    if (externalSecretsFile) {
      secrets = await this.mergeExternalSecrets(secrets, jobId, externalSecretsFile);
    }

    let jobSecrets = (secrets as any)[jobId];

    if (!jobSecrets) {
      throw new Error(`No secrets found for job ID: ${jobId}. ${externalSecretsFile ? `Please ensure the external secrets file contains job-specific secrets for "${jobId}".` : 'Please add secrets manually first.'}`);
    }

    if (!jobSecrets.database || Object.keys(jobSecrets.database).length === 0) {
      throw new Error(`No database configurations found for job ID: ${jobId}`);
    }

    // Collect job metadata
    const metadata = await this.collectJobMetadata(jobId);

    // Check for missing integration ID and ask for it
    const updatedSecrets = await this.checkAndCollectMissingSecrets(secrets, jobId, jobSecrets);
    if (updatedSecrets) {
      secrets = updatedSecrets;
      jobSecrets = (secrets as any)[jobId];
    }

    // Get database configurations
    const databases = Object.keys(jobSecrets.database).map((name) => ({
      name,
      config: jobSecrets.database[name],
    }));

    // Build outputs based on existing secrets and prompt for new ones
    const outputResult = await this.buildOutputsFromSecrets(jobId, jobSecrets, secrets);
    const outputs = outputResult.outputs;
    const webhookUpdatedSecrets = outputResult.updatedSecrets;

    // Generate config file
    await this.generateConfigFile(configDir, jobId, metadata, databases, outputs, dbType);

    console.log('\n🎉 Config Generation Complete!');
    console.log(`✅ Config file created: ${join(configDir, jobId + '.yml')}`);
    console.log(`✅ Using existing secrets for job: ${jobId}`);
    if (updatedSecrets) {
      console.log(`✅ Secrets updated with missing integration ID`);
    }
    if (webhookUpdatedSecrets) {
      console.log(`✅ Secrets updated with webhook configuration`);
    }
    console.log('\n🏃 You can now run your job with:');
    console.log(`   docker-compose run --rm querybird-cli run-once --job-id ${jobId}`);
  }

  private async collectJobMetadata(jobId: string): Promise<JobMetadata> {
    console.log('📋 Job Configuration');
    console.log('===================\n');
    console.log(`Job ID: ${jobId} (using existing secrets)\n`);

    // Check if running non-interactively (no TTY)
    if (!process.stdin.isTTY) {
      console.log('Non-interactive mode detected, using default values');
      return {
        name: `${jobId} Job`,
        description: 'Export user data from database',
        schedule: '0 2 * * *',
      };
    }

    const name = await this.promptForInput('Job Name (e.g., Daily User Export)', 'string', true);
    const description = await this.promptForInput('Job Description', 'string', false, 'Export user data from database');
    const schedule = await this.promptForInput('Cron Schedule (e.g., 0 2 * * * for daily at 2 AM)', 'string', false, '0 2 * * *');

    return { name, description, schedule };
  }

  private async checkAndCollectMissingSecrets(secrets: SecretsConfig, jobId: string, jobSecrets: any): Promise<SecretsConfig | null> {
    // Skip interactive prompts in non-TTY mode
    if (!process.stdin.isTTY) {
      console.log('Non-interactive mode: skipping Balkan ID configuration');
      return null;
    }

    let needsUpdate = false;
    let updatedSecrets = { ...secrets };
    const updatedJobSecrets = { ...jobSecrets };

    // Check if global Balkan secrets exist
    const globalBalkan = (updatedSecrets as any).balkan;
    if (!globalBalkan?.balkan_key_id || !globalBalkan?.balkan_key_secret) {
      console.log('\n🔑 Global Balkan API credentials not found');
      const hasBalkan = await this.promptForConfirmation('Do you want to configure Balkan ID integration?', false);

      if (hasBalkan) {
        console.log('Please configure global Balkan API credentials:');
        const keyId = await this.promptForInput('Balkan API Key ID', 'string', true);
        const keySecret = await this.promptForInput('Balkan API Key Secret', 'password', true);

        if (!(updatedSecrets as any).balkan) {
          (updatedSecrets as any).balkan = {};
        }
        (updatedSecrets as any).balkan.balkan_key_id = keyId;
        (updatedSecrets as any).balkan.balkan_key_secret = keySecret;
        needsUpdate = true;
        console.log('✅ Global Balkan credentials will be saved');
      }
    }

    // Check for integration ID if global Balkan exists or was just configured
    const balkanExists = (updatedSecrets as any).balkan?.balkan_key_id && (updatedSecrets as any).balkan?.balkan_key_secret;
    if (balkanExists && !jobSecrets.api_keys?.balkan_integration_id) {
      console.log('\n🔗 Balkan Integration Configuration');
      const integrationId = await this.promptForInput('Balkan Integration ID', 'string', true);

      if (!updatedJobSecrets.api_keys) updatedJobSecrets.api_keys = {};
      updatedJobSecrets.api_keys.balkan_integration_id = integrationId;
      (updatedSecrets as any)[jobId] = updatedJobSecrets;
      needsUpdate = true;
      console.log('✅ Integration ID will be saved');
    }

    if (needsUpdate) {
      await this.secretsManager.saveSecrets(updatedSecrets);
      return updatedSecrets;
    }

    return null;
  }

  private async promptForConfirmation(prompt: string, defaultValue: boolean = false): Promise<boolean> {
    const defaultText = defaultValue ? ' (Y/n)' : ' (y/N)';
    const input = await this.readInput(`${prompt}${defaultText}: `);
    const value = input.trim().toLowerCase();

    if (!value) {
      return defaultValue;
    }

    return value.startsWith('y');
  }

  private async buildOutputsFromSecrets(jobId: string, jobSecrets: any, secrets: SecretsConfig): Promise<{ outputs: any[]; updatedSecrets?: SecretsConfig }> {
    const outputs: any[] = [];
    let updatedSecrets: SecretsConfig | undefined;
    let needsUpdate = false;

    // Check for existing webhook configuration
    let hasWebhookInSecrets = jobSecrets.webhooks?.webhook_url;

    // If no webhook configured, prompt to add one (skip in non-interactive mode)
    if (!hasWebhookInSecrets && process.stdin.isTTY) {
      console.log('\n📤 Output Configuration');
      const hasWebhook = await this.promptForConfirmation('Do you want to send data to a webhook?', false);

      if (hasWebhook) {
        const webhookUrl = await this.promptForInput('Webhook URL', 'url', true);

        // Update job secrets with webhook configuration
        if (!updatedSecrets) {
          updatedSecrets = { ...secrets };
        }
        const updatedJobSecrets = { ...(updatedSecrets as any)[jobId] };
        if (!updatedJobSecrets.webhooks) updatedJobSecrets.webhooks = {};
        updatedJobSecrets.webhooks.webhook_url = webhookUrl;
        (updatedSecrets as any)[jobId] = updatedJobSecrets;
        needsUpdate = true;
        hasWebhookInSecrets = true;

        console.log('✅ Webhook URL will be saved to secrets');
      }
    }

    // Add webhook output if configured
    if (hasWebhookInSecrets) {
      outputs.push({
        type: 'webhook',
        endpoint: `!secrets ${jobId}.webhooks.webhook_url`,
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-QueryBird-Job': jobId,
        },
        retryCount: 2,
      });
    }

    // Add Balkan ID output if configured
    if (jobSecrets.api_keys?.balkan_integration_id || (updatedSecrets as any)?.[jobId]?.api_keys?.balkan_integration_id) {
      outputs.push({
        type: 'http',
        endpoint: 'https://app.balkan.id/api/rest/v0/entitlements/upload-url',
        method: 'POST',
        headers: {
          'X-Api-Key-ID': `!secrets balkan.balkan_key_id`,
          'X-Api-Key-Secret': `!secrets balkan.balkan_key_secret`,
        },
        body: {
          integrationId: `!secrets ${jobId}.api_keys.balkan_integration_id`,
        },
        response_url_field: 'url',
        upload_method: 'PUT',
        format: 'csv',
        retryCount: 3,
      });
    }

    if (needsUpdate && updatedSecrets) {
      await this.secretsManager.saveSecrets(updatedSecrets);
    }

    return { outputs, updatedSecrets: needsUpdate ? updatedSecrets : undefined };
  }

  private async generateConfigFile(configDir: string, jobId: string, metadata: JobMetadata, databases: Array<{ name: string; config: any }>, outputs: any[], dbType: 'postgres' | 'mysql'): Promise<void> {
    await mkdir(configDir, { recursive: true });

    const input: any = {};

    if (databases.length > 1) {
      input[dbType] = databases.map((db) => ({
        name: db.name,
        connection_info: `!secrets ${jobId}.database.${db.name}`,
        sql: [
          {
            name: 'users',
            sql: this.getDefaultSql(dbType),
          },
        ],
      }));
    } else {
      const db = databases[0];
      input[dbType] = {
        name: db.name,
        connection_info: `!secrets ${jobId}.database.${db.name}`,
        sql: [
          {
            name: 'users',
            sql: this.getDefaultSql(dbType),
          },
        ],
      };
    }

    const transform = this.generateTransform(databases, metadata.name, dbType);

    const config = {
      id: jobId,
      name: metadata.name,
      description: metadata.description,
      input,
      transform,
      schedule: metadata.schedule,
      enabled: true,
      outputs,
      timeout: 30000,
    };

    const configPath = join(configDir, `${jobId}.yml`);
    const yamlContent = YAML.stringify(config, {
      indent: 2,
      lineWidth: -1,
    });

    await writeFile(configPath, yamlContent);
  }

  private getDefaultSql(dbType: 'postgres' | 'mysql'): string {
    if (dbType === 'postgres') {
      return `SELECT 
        rolname AS username,
        rolsuper AS is_superuser,
        rolcreaterole AS can_create_role,
        rolcreatedb AS can_create_db,
        rolcanlogin AS can_login,
        CURRENT_TIMESTAMP AS last_login_time,
        CURRENT_TIMESTAMP AS last_password_changed_time
      FROM pg_roles
      WHERE rolcanlogin = true;`;
    } else {
      return `SELECT 
        User AS username,
        Host AS host,
        CASE WHEN Super_priv = 'Y' THEN 1 ELSE 0 END AS is_superuser,
        CASE WHEN Create_role_priv = 'Y' THEN 1 ELSE 0 END AS can_create_role,
        CASE WHEN Create_priv = 'Y' THEN 1 ELSE 0 END AS can_create_db,
        CASE WHEN User != '' THEN 1 ELSE 0 END AS can_login,
        NOW() AS last_login_time,
        password_last_changed AS last_password_changed_time
      FROM mysql.user
      WHERE User != '';`;
    }
  }

  private generateTransform(databases: Array<{ name: string; config: any }>, projectName: string, dbType: 'postgres' | 'mysql' = 'postgres'): string {
    if (dbType === 'mysql') {
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
          has_super_priv ? [{
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
    } else {
      // PostgreSQL transformation
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
    }
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

  /**
   * Merge job-specific secrets from an external secrets file into the main secrets
   * @param mainSecrets - Current secrets from the service's secrets.json
   * @param jobId - Job ID to extract from external file
   * @param externalSecretsFile - Path to external secrets file
   * @returns Updated secrets with merged job-specific data
   */
  private async mergeExternalSecrets(mainSecrets: SecretsConfig, jobId: string, externalSecretsFile: string): Promise<SecretsConfig> {
    try {
      this.logger.info(`📂 Loading external secrets from: ${externalSecretsFile}`);

      // Load external secrets file
      const externalSecretsManager = new ImprovedSecretsManager(externalSecretsFile);
      const externalSecrets = await externalSecretsManager.loadSecrets();

      // Check if job ID exists in external file
      const externalJobSecrets = (externalSecrets as any)[jobId];
      if (!externalJobSecrets) {
        throw new Error(`Job ID "${jobId}" not found in external secrets file: ${externalSecretsFile}`);
      }

      this.logger.info(`✅ Found job "${jobId}" in external secrets file`);

      // Validate external job secrets structure
      if (!externalJobSecrets.database || Object.keys(externalJobSecrets.database).length === 0) {
        throw new Error(`Job ID "${jobId}" in external secrets file has no database configurations`);
      }

      // Count databases being imported
      const dbCount = Object.keys(externalJobSecrets.database).length;
      this.logger.info(`🔄 Importing ${dbCount} database configuration(s) for job "${jobId}"`);

      // Create updated main secrets with merged job data
      const updatedSecrets = { ...mainSecrets };
      (updatedSecrets as any)[jobId] = {
        database: { ...externalJobSecrets.database },
        api_keys: { ...externalJobSecrets.api_keys },
        webhooks: { ...externalJobSecrets.webhooks },
        ...(externalJobSecrets.config && { config: { ...externalJobSecrets.config } }),
      };

      // Note: Global Balkan API keys are only used from the main secrets.json file
      // and are never imported from external secrets files

      // Save the merged secrets to the main secrets file
      await this.secretsManager.saveSecrets(updatedSecrets);
      this.logger.info(`💾 Successfully merged and saved secrets for job "${jobId}"`);

      // List imported databases for user confirmation
      const dbNames = Object.keys(externalJobSecrets.database);
      this.logger.info(`📋 Imported databases: ${dbNames.join(', ')}`);

      return updatedSecrets;
    } catch (error) {
      if (error instanceof Error && error.message.includes('ENOENT')) {
        throw new Error(`External secrets file not found: ${externalSecretsFile}`);
      }
      throw new Error(`Failed to merge external secrets: ${error instanceof Error ? error.message : String(error)}`);
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
}
