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

  private sanitizeAndLog(level: keyof LogLevel, logFunction: Function, message: string, ...args: any[]) {
    if (this.shouldLog(level)) {
      const sanitizedMessage = sanitizeLogInput(message);
      const sanitizedArgs = args.map(arg => {
        if (typeof arg === 'string') {
          try {
            return sanitizeLogInput(arg);
          } catch (error) {
            // If sanitization fails, convert to string and try again
            return sanitizeLogInput(String(arg));
          }
        }
        return arg;
      });
      logFunction(`[${this.context}] ${sanitizedMessage}`, ...sanitizedArgs);
    }
  }

  public error(message: string, ...args: any[]) {
    this.sanitizeAndLog('error', console.error.bind(console), message, ...args);
  }

  public warn(message: string, ...args: any[]) {
    this.sanitizeAndLog('warn', console.warn.bind(console), message, ...args);
  }

  public info(message: string, ...args: any[]) {
    this.sanitizeAndLog('info', console.info.bind(console), message, ...args);
  }

  public debug(message: string, ...args: any[]) {
    this.sanitizeAndLog('debug', console.debug.bind(console), message, ...args);
  }
}
