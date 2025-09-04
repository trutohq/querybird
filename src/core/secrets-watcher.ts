import { watch, FSWatcher } from 'fs';
import { stat } from 'fs/promises';
import { Logger } from '../utils/logger';

export interface SecretsWatcherOptions {
  secretsFile: string;
  logger?: Logger;
  onSecretsChange?: () => void;
  onError?: (error: Error) => void;
  debounceMs?: number;
}

export class SecretsWatcher {
  private watcher: FSWatcher | null = null;
  private logger: Logger;
  private debounceTimer: NodeJS.Timeout | null = null;
  private debounceMs: number;

  constructor(private options: SecretsWatcherOptions) {
    this.logger = options.logger || new Logger();
    this.debounceMs = options.debounceMs || 500; // Default 500ms debounce
  }

  async start(): Promise<void> {
    await this.watchSecretsFile();
    this.logger.info(`Secrets watcher started, monitoring: ${this.options.secretsFile}`);
  }

  private async watchSecretsFile(): Promise<void> {
    try {
      // Check if secrets file exists first
      await stat(this.options.secretsFile);
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
        this.logger.info('Secrets file does not exist yet, will start watching when created');
      } else {
        this.logger.error('Error checking secrets file:', { error: error instanceof Error ? error.message : String(error) });
        this.options.onError?.(error as Error);
      }
    }

    // Watch the secrets file directly
    this.watcher = watch(this.options.secretsFile, { persistent: true }, async (eventType, filename) => {
      if (eventType === 'change') {
        this.debouncedSecretsChange();
      }
    });

    const cleanup = (): void => {
      if (this.watcher) {
        this.watcher.close();
      }
      if (this.debounceTimer) {
        clearTimeout(this.debounceTimer);
      }
    };

    process.on('SIGTERM', cleanup);
    process.on('SIGINT', cleanup);
  }

  private debouncedSecretsChange(): void {
    // Clear any existing timer
    if (this.debounceTimer) {
      clearTimeout(this.debounceTimer);
    }

    // Set new timer
    this.debounceTimer = setTimeout(async () => {
      try {
        // Verify file still exists and is readable
        await stat(this.options.secretsFile);
        
        this.logger.info('Secrets file changed, reloading...');
        this.options.onSecretsChange?.();
      } catch (error) {
        if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
          this.logger.warn('Secrets file was deleted, keeping existing secrets in memory');
        } else {
          this.logger.error('Error during secrets reload:', { error: error instanceof Error ? error.message : String(error) });
          this.options.onError?.(error as Error);
        }
      }
    }, this.debounceMs);
  }

  stop(): void {
    if (this.watcher) {
      this.watcher.close();
      this.watcher = null;
    }
    
    if (this.debounceTimer) {
      clearTimeout(this.debounceTimer);
      this.debounceTimer = null;
    }
    
    this.logger.info('Secrets watcher stopped');
  }
}