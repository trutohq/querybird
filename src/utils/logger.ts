export type LogLevelName = 'error' | 'warn' | 'info' | 'debug';

export interface LogLevel {
  ERROR: 0;
  WARN: 1;
  INFO: 2;
  DEBUG: 3;
}

export interface LogEntry {
  level: string;
  message: string;
  timestamp: Date;
  context?: Record<string, unknown>;
  error?: Error;
}

export class Logger {
  private readonly levels: LogLevel = { ERROR: 0, WARN: 1, INFO: 2, DEBUG: 3 };
  private readonly currentLevel: number;
  private readonly instanceName?: string;

  constructor(level: LogLevelName = 'info', instanceName?: string) {
    this.currentLevel = this.levels[level.toUpperCase() as keyof LogLevel] ?? this.levels.INFO;
    this.instanceName = instanceName;
  }

  private shouldLog(level: number): boolean {
    return level <= this.currentLevel;
  }

  private formatMessage(level: string, message: string, context?: Record<string, unknown>): string {
    const timestamp = new Date().toISOString();
    const instance = this.instanceName ? ` [${this.instanceName}]` : '';
    const contextStr = context ? ` ${JSON.stringify(context)}` : '';

    return `${timestamp} [${level}]${instance}: ${message}${contextStr}`;
  }

  private log(level: string, levelNum: number, message: string, context?: Record<string, unknown>): void {
    if (!this.shouldLog(levelNum)) return;

    const formatted = this.formatMessage(level, message, context);

    switch (levelNum) {
      case this.levels.ERROR:
        console.error(formatted);
        break;
      case this.levels.WARN:
        console.warn(formatted);
        break;
      default:
        console.log(formatted);
        break;
    }
  }

  error(message: string, context?: Record<string, unknown>): void {
    this.log('ERROR', this.levels.ERROR, message, context);
  }

  warn(message: string, context?: Record<string, unknown>): void {
    this.log('WARN', this.levels.WARN, message, context);
  }

  info(message: string, context?: Record<string, unknown>): void {
    this.log('INFO', this.levels.INFO, message, context);
  }

  debug(message: string, context?: Record<string, unknown>): void {
    this.log('DEBUG', this.levels.DEBUG, message, context);
  }

  child(context: Record<string, unknown>): Logger {
    return new ChildLogger(this, context);
  }
}

class ChildLogger extends Logger {
  constructor(private readonly parent: Logger, private readonly defaultContext: Record<string, unknown>) {
    super();
  }

  error(message: string, context?: Record<string, unknown>): void {
    this.parent.error(message, { ...this.defaultContext, ...context });
  }

  warn(message: string, context?: Record<string, unknown>): void {
    this.parent.warn(message, { ...this.defaultContext, ...context });
  }

  info(message: string, context?: Record<string, unknown>): void {
    this.parent.info(message, { ...this.defaultContext, ...context });
  }

  debug(message: string, context?: Record<string, unknown>): void {
    this.parent.debug(message, { ...this.defaultContext, ...context });
  }
}

// Default logger instance for backward compatibility
export const logger = new Logger();
