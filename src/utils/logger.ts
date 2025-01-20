interface LogLevel {
  error: number;
  warn: number;
  info: number;
  debug: number;
}

export class Logger {
  private static loglevel: keyof LogLevel = 'debug';
  private static readonly logLevels: LogLevel = {
    error: 1,
    warn: 2,
    info: 3,
    debug: 4,
  };

  constructor(private context: string) {
    this.context = context;
  }

  public static setLogLevel(level: keyof LogLevel) {
    this.loglevel = level;
  }

  private shouldLog(level: keyof LogLevel): boolean {
    return Logger.logLevels[level] <= Logger.logLevels[Logger.loglevel];
  }

  public error(message: string, ...args: any[]) {
    if (this.shouldLog('error')) {
      console.error(`[${this.context}] ${message}`, ...args);
    }
  }

  public warn(message: string, ...args: any[]) {
    if (this.shouldLog('warn')) {
      console.warn(`[${this.context}] ${message}`, ...args);
    }
  }

  public info(message: string, ...args: any[]) {
    if (this.shouldLog('info')) {
      console.info(`[${this.context}] ${message}`, ...args);
    }
  }

  public debug(message: string, ...args: any[]) {
    if (this.shouldLog('debug')) {
      console.debug(`[${this.context}] ${message}`, ...args);
    }
  }
}
