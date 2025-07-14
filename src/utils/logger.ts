import { sanitizeLogInput } from './security';

interface LogLevel {
  error: number;
  warn: number;
  info: number;
  debug: number;
}

export class Logger {
  private static isProduction = process.env.NODE_ENV === 'production';
  private static loglevel: keyof LogLevel = Logger.isProduction ? 'error' : 'debug';
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
      const sanitizedMessage = sanitizeLogInput(message);
      const sanitizedArgs = args.map(arg => 
        typeof arg === 'string' ? sanitizeLogInput(arg) : arg
      );
      console.error(`[${this.context}] ${sanitizedMessage}`, ...sanitizedArgs);
    }
  }

  public warn(message: string, ...args: any[]) {
    if (this.shouldLog('warn')) {
      const sanitizedMessage = sanitizeLogInput(message);
      const sanitizedArgs = args.map(arg => 
        typeof arg === 'string' ? sanitizeLogInput(arg) : arg
      );
      console.warn(`[${this.context}] ${sanitizedMessage}`, ...sanitizedArgs);
    }
  }

  public info(message: string, ...args: any[]) {
    if (this.shouldLog('info')) {
      const sanitizedMessage = sanitizeLogInput(message);
      const sanitizedArgs = args.map(arg => 
        typeof arg === 'string' ? sanitizeLogInput(arg) : arg
      );
      console.info(`[${this.context}] ${sanitizedMessage}`, ...sanitizedArgs);
    }
  }

  public debug(message: string, ...args: any[]) {
    if (this.shouldLog('debug')) {
      const sanitizedMessage = sanitizeLogInput(message);
      const sanitizedArgs = args.map(arg => 
        typeof arg === 'string' ? sanitizeLogInput(arg) : arg
      );
      console.debug(`[${this.context}] ${sanitizedMessage}`, ...sanitizedArgs);
    }
  }
}
