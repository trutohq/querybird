import { watch, FSWatcher } from 'fs';
import { readdir, readFile, stat } from 'fs/promises';
import { join, extname, basename } from 'path';
import { parse as parseYaml } from 'yaml';
import { Job, JobSchema } from '../types/job-schema';
import { Logger } from '../utils/logger';

export interface ConfigWatcherOptions {
  configDir: string;
  logger?: Logger;
  onJobChange?: (jobs: Map<string, Job>) => void;
  onError?: (error: Error) => void;
}

export class ConfigWatcher {
  private jobs = new Map<string, Job>();
  private watchers = new Map<string, FSWatcher>();
  private logger: Logger;

  constructor(private options: ConfigWatcherOptions) {
    this.logger = options.logger || new Logger();
  }

  async start(): Promise<void> {
    await this.loadAllJobs();
    await this.watchDirectory();
    this.logger.info(`Config watcher started, monitoring: ${this.options.configDir}`);
  }

  private async loadAllJobs(): Promise<void> {
    try {
      const files = await readdir(this.options.configDir);
      const jobFiles = files.filter(f => ['.yml', '.yaml', '.json'].includes(extname(f)));
      
      this.jobs.clear();
      
      for (const file of jobFiles) {
        await this.loadJobFile(join(this.options.configDir, file));
      }

      this.logger.info(`Loaded ${this.jobs.size} jobs from config directory`);
      this.options.onJobChange?.(new Map(this.jobs));
    } catch (error) {
      this.logger.error('Failed to load jobs:', { error: error instanceof Error ? error.message : String(error) });
      this.options.onError?.(error as Error);
    }
  }

  private async loadJobFile(filePath: string): Promise<void> {
    try {
      const content = await readFile(filePath, 'utf-8');
      const ext = extname(filePath);
      
      let jobData: unknown;
      if (ext === '.json') {
        jobData = JSON.parse(content);
      } else {
        jobData = parseYaml(content);
      }

      const job = JobSchema.parse(jobData);
      const previousJob = this.jobs.get(job.id);
      
      this.jobs.set(job.id, job);
      
      if (!previousJob) {
        this.logger.info(`Added job: ${job.id} from ${basename(filePath)}`);
      } else {
        this.logger.info(`Updated job: ${job.id} from ${basename(filePath)}`);
      }
    } catch (error) {
      this.logger.error(`Failed to load job from ${filePath}:`, { error: error instanceof Error ? error.message : String(error) });
      // Don't propagate error - continue with other jobs
    }
  }

  private async watchDirectory(): Promise<void> {
    const watcher = watch(this.options.configDir, { persistent: true }, async (eventType, filename) => {
      if (!filename) return;
      
      const ext = extname(filename);
      if (!['.yml', '.yaml', '.json'].includes(ext)) return;

      const filePath = join(this.options.configDir, filename);

      try {
        const fileStats = await stat(filePath);
        
        if (eventType === 'change' || eventType === 'rename') {
          if (fileStats.isFile()) {
            await this.loadJobFile(filePath);
            this.options.onJobChange?.(new Map(this.jobs));
          }
        }
      } catch (error) {
        if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
          const jobId = basename(filename, ext);
          if (this.jobs.has(jobId)) {
            this.jobs.delete(jobId);
            this.logger.info(`Removed job: ${jobId} (file deleted)`);
            this.options.onJobChange?.(new Map(this.jobs));
          }
        }
      }
    });

    this.watchers.set('main', watcher);

    const cleanup = (): void => {
      watcher.close();
    };

    process.on('SIGTERM', cleanup);
    process.on('SIGINT', cleanup);
  }

  getJobs(): Map<string, Job> {
    return new Map(this.jobs);
  }

  getJob(id: string): Job | undefined {
    return this.jobs.get(id);
  }

  stop(): void {
    for (const watcher of this.watchers.values()) {
      if (typeof watcher.close === 'function') {
        watcher.close();
      }
    }
    this.watchers.clear();
  }
}