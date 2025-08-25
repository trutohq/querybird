import { Cron } from 'croner';
import jsonata from 'jsonata';
import { Job, Input, Output } from '../types/job-schema';
import { ConfigWatcher } from './config-watcher';
import { ImprovedSecretsManager } from '../utils/improved-secrets-manager';
import { Logger } from '../utils/logger';
import { DatabaseManager } from './database-manager';
import { OutputManager } from './output-manager';

export interface JobRunnerOptions {
  configDir: string;
  secretsFile: string;
  logger?: Logger;
  encryptionPassword?: string;
  maxConcurrentJobs?: number;
}

export interface JobExecution {
  jobId: string;
  startedAt: Date;
  status: 'running' | 'completed' | 'failed';
  result?: { recordCount?: number };
  error?: Error;
  duration?: number;
}

export class JobRunner {
  private configWatcher: ConfigWatcher;
  private secretsManager: ImprovedSecretsManager;
  private dbManager: DatabaseManager;
  private outputManager: OutputManager;
  private logger: Logger;
  private scheduledJobs = new Map<string, Cron>();
  private runningJobs = new Map<string, JobExecution>();
  private maxConcurrentJobs: number;

  constructor(options: JobRunnerOptions) {
    this.logger = options.logger || new Logger();
    this.maxConcurrentJobs = options.maxConcurrentJobs || 10;

    this.secretsManager = new ImprovedSecretsManager(options.secretsFile, options.encryptionPassword);

    this.dbManager = new DatabaseManager(this.secretsManager, this.logger);
    this.outputManager = new OutputManager(this.secretsManager, this.logger);

    this.configWatcher = new ConfigWatcher({
      configDir: options.configDir,
      logger: this.logger,
      onJobChange: this.handleJobsChange.bind(this),
      onError: this.handleConfigError.bind(this),
    });
  }

  async start(): Promise<void> {
    await this.configWatcher.start();
    this.logger.info('Job runner started');
  }

  private handleJobsChange(jobs: Map<string, Job>): void {
    // Stop removed jobs
    for (const [jobId] of this.scheduledJobs) {
      if (!jobs.has(jobId)) {
        this.stopJob(jobId);
      }
    }

    // Start/update jobs
    for (const [jobId, job] of jobs) {
      if (job.enabled) {
        this.scheduleJob(job);
      } else {
        this.stopJob(jobId);
      }
    }
  }

  private scheduleJob(job: Job): void {
    // Stop existing scheduled job if any
    this.stopJob(job.id);

    try {
      const cronJob = new Cron(job.schedule, { timezone: 'UTC' }, async () => {
        await this.executeJob(job);
      });

      this.scheduledJobs.set(job.id, cronJob);
      this.logger.info(`Scheduled job: ${job.id} with schedule: ${job.schedule}`);
    } catch (error) {
      this.logger.error(`Failed to schedule job ${job.id}:`, { error: error instanceof Error ? error.message : String(error) });
    }
  }

  private stopJob(jobId: string): void {
    const cronJob = this.scheduledJobs.get(jobId);
    if (cronJob) {
      cronJob.stop();
      this.scheduledJobs.delete(jobId);
      this.logger.info(`Stopped job: ${jobId}`);
    }
  }

  async executeJob(job: Job): Promise<JobExecution> {
    // Check if job is already running
    if (this.runningJobs.has(job.id)) {
      this.logger.warn(`Job ${job.id} is already running, skipping this execution`);
      return this.runningJobs.get(job.id)!;
    }

    // Check concurrent job limit
    if (this.runningJobs.size >= this.maxConcurrentJobs) {
      throw new Error(`Max concurrent jobs limit reached: ${this.maxConcurrentJobs}`);
    }

    const execution: JobExecution = {
      jobId: job.id,
      startedAt: new Date(),
      status: 'running',
    };

    this.runningJobs.set(job.id, execution);
    this.logger.info(`Starting job execution: ${job.id}`);

    try {
      const startTime = Date.now();

      // Execute input stage
      const inputData = await this.executeInput(job.input);

      // Apply transformation
      const transformedData = await this.applyTransformation(inputData, job.transform);

      // Send to outputs
      await this.sendToOutputs(transformedData, job.outputs);

      const duration = Date.now() - startTime;
      execution.status = 'completed';
      execution.duration = duration;
      execution.result = { recordCount: Array.isArray(transformedData) ? transformedData.length : 1 };

      this.logger.info(`Job ${job.id} completed successfully in ${duration}ms`);
    } catch (error) {
      execution.status = 'failed';
      execution.error = error instanceof Error ? error : new Error(String(error));
      execution.duration = Date.now() - execution.startedAt.getTime();

      this.logger.error(`Job ${job.id} failed:`, { error: execution.error?.message || 'Unknown error' });
    } finally {
      this.runningJobs.delete(job.id);
    }

    return execution;
  }

  private async executeInput(input: Input): Promise<unknown> {
    const results: Record<string, unknown> = {};

    if (input.postgres) {
      const postgresResults = await this.executeDbQuery('postgres', input.postgres);
      Object.assign(results, postgresResults);
    }

    if (input.mysql) {
      const mysqlResults = await this.executeDbQuery('mysql', input.mysql);
      Object.assign(results, mysqlResults);
    }

    if (input.http) {
      const httpResults = await this.executeHttpRequest(input.http);
      results.http = httpResults;
    }

    if (Object.keys(results).length === 0) {
      throw new Error('No valid input source specified');
    }

    return results;
  }

  private async executeDbQuery(type: 'postgres' | 'mysql', config: { connection_info: string; sql: Array<{ name: string; sql: string }> } | Array<{ name: string; connection_info: string; sql: Array<{ name: string; sql: string }> }>): Promise<Record<string, unknown>> {
    const results: Record<string, unknown> = {};

    // Handle array of connections
    if (Array.isArray(config)) {
      // Add a connections_info object at the root level for easy access
      results.connections_info = {};

      for (const dbConfig of config) {
        try {
          this.logger.debug(`Executing queries for database: ${dbConfig.name}`);
          
          const connectionInfo = await this.secretsManager.resolveSecret(dbConfig.connection_info);
          const connection = await this.dbManager.getConnection(type, connectionInfo);

          // Parse connection info to extract db_name and region
          const connectionDetails = this.parseConnectionInfo(connectionInfo);

          // Store connection info at root level for easy access
          (results.connections_info as Record<string, unknown>)[dbConfig.name] = connectionDetails;

          // Initialize database result object
          if (!results[dbConfig.name]) {
            results[dbConfig.name] = {};
          }

          for (const query of dbConfig.sql) {
            this.logger.debug(`Executing query '${query.name}' on database '${dbConfig.name}'`);
            
            const data = await connection.query(query.sql);
            this.logger.debug(`Query '${query.name}' on database '${dbConfig.name}' returned ${Array.isArray(data) ? data.length : 'non-array'} results`);

            // Store data in nested structure: results[db_name][query_name]
            (results[dbConfig.name] as Record<string, unknown>)[query.name] = data;
          }

          // Add connection_info to the individual database context
          (results[dbConfig.name] as Record<string, unknown>).connection_info = connectionDetails;
          
          this.logger.debug(`Successfully completed queries for database: ${dbConfig.name}`);
        } catch (error) {
          this.logger.error(`Failed to execute queries for database '${dbConfig.name}':`, { error: error instanceof Error ? error.message : String(error) });
          // Continue with other databases instead of stopping entirely
          results[dbConfig.name] = {
            error: error instanceof Error ? error.message : String(error),
            connection_info: {}
          };
        }
      }
    } else {
      // Handle single connection - now with required name field
      const connectionInfo = await this.secretsManager.resolveSecret(config.connection_info);
      const connection = await this.dbManager.getConnection(type, connectionInfo);

      // Parse connection info to extract db_name and region
      const connectionDetails = this.parseConnectionInfo(connectionInfo);

      // If config has a name field (new schema), use nested structure
      if (config.name) {
        // Add connections_info at root level for consistency
        results.connections_info = {};
        (results.connections_info as Record<string, unknown>)[config.name] = connectionDetails;

        // Create nested structure: results[db_name][query_name]
        results[config.name] = {};
        
        for (const query of config.sql) {
          const data = await connection.query(query.sql);
          (results[config.name] as Record<string, unknown>)[query.name] = data;
        }
        
        // Add connection_info to the individual database context
        (results[config.name] as Record<string, unknown>).connection_info = connectionDetails;
      } else {
        // Legacy format without name field
        for (const query of config.sql) {
          const data = await connection.query(query.sql);
          results[query.name] = data;
        }
        
        // Add connection_info to the root context
        results.connection_info = connectionDetails;
      }
    }

    return results;
  }

  private parseConnectionInfo(connectionInfo: string): Record<string, unknown> {
    try {
      // Try to parse as JSON first
      const config = JSON.parse(connectionInfo);
      return {
        db_name: config.database || 'unknown',
        region: config.region || 'default',
        host: config.host,
        port: config.port,
        user: config.user || config.username,
        ssl: config.ssl,
      };
    } catch (error) {
      // If not JSON, try to parse as URL
      try {
        const urlObj = new URL(connectionInfo);
        return {
          db_name: urlObj.pathname.slice(1) || 'unknown',
          region: urlObj.searchParams.get('region') || 'default',
          host: urlObj.hostname,
          port: urlObj.port ? parseInt(urlObj.port, 10) : undefined,
          user: urlObj.username,
          ssl: urlObj.searchParams.get('ssl') !== 'false',
        };
      } catch (urlError) {
        // If neither JSON nor URL, return basic info
        return {
          db_name: 'unknown',
          region: 'default',
          connection_string: connectionInfo,
        };
      }
    }
  }

  private async executeHttpRequest(config: { url: string; method: 'GET' | 'POST'; headers?: string | Record<string, string> }): Promise<unknown> {
    const url = await this.secretsManager.resolveSecret(config.url);

    const headers: Record<string, string> = {};
    if (config.headers) {
      if (typeof config.headers === 'string') {
        const resolvedHeaders = await this.secretsManager.resolveSecret(config.headers);
        try {
          Object.assign(headers, JSON.parse(resolvedHeaders));
        } catch {
          // If not valid JSON, ignore headers
        }
      } else {
        for (const [key, value] of Object.entries(config.headers)) {
          headers[key] = await this.secretsManager.resolveSecret(value);
        }
      }
    }

    const response = await fetch(url, {
      method: config.method,
      headers,
    });

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }

    const contentType = response.headers.get('content-type') || '';
    if (contentType.includes('application/json')) {
      return response.json();
    } else {
      return response.text();
    }
  }

  private async applyTransformation(data: unknown, transformExpression: string): Promise<unknown> {
    try {
      const expr = jsonata(transformExpression);
      return await expr.evaluate(data);
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      throw new Error(`Transformation failed: ${errorMessage}`);
    }
  }

  private async sendToOutputs(data: unknown, outputs: Output[]): Promise<void> {
    const promises = outputs.map((output) => this.outputManager.send(data, output));
    await Promise.all(promises);
  }

  async executeJobOnce(jobId: string): Promise<JobExecution | null> {
    const job = this.configWatcher.getJob(jobId);
    if (!job) {
      throw new Error(`Job not found: ${jobId}`);
    }

    return this.executeJob(job);
  }

  getRunningJobs(): Map<string, JobExecution> {
    return new Map(this.runningJobs);
  }

  getScheduledJobs(): string[] {
    return Array.from(this.scheduledJobs.keys());
  }

  private handleConfigError(error: Error): void {
    this.logger.error('Config watcher error:', { error: error instanceof Error ? error.message : String(error) });
  }

  async stop(): Promise<void> {
    // Stop all scheduled jobs
    for (const cronJob of this.scheduledJobs.values()) {
      cronJob.stop();
    }
    this.scheduledJobs.clear();

    // Wait for running jobs to complete (with timeout)
    const timeout = 30000; // 30 seconds
    const start = Date.now();

    while (this.runningJobs.size > 0 && Date.now() - start < timeout) {
      await new Promise((resolve) => setTimeout(resolve, 100));
    }

    if (this.runningJobs.size > 0) {
      this.logger.warn(`Forced shutdown with ${this.runningJobs.size} jobs still running`);
    }

    this.configWatcher.stop();
    await this.dbManager.closeAll();

    this.logger.info('Job runner stopped');
  }
}
