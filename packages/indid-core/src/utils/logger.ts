export enum LogLevel {
    NONE,
    DEBUG,
    INFO,
    WARNING,
    ERROR
  }
  
  interface ILogger {
    log(...args: any[]): void;
    debug(...args: any[]): void;
    info(...args: any[]): void;
    warn(...args: any[]): void;
    error(...args: any[]): void;
  }
  
  export class Logger implements ILogger {
    private static instance: Logger;
    private logLevel: LogLevel;

    private constructor(logLevel: LogLevel) {
      this.logLevel = logLevel;
    }

    static getInstance(logLevel: LogLevel = LogLevel.NONE): Logger {
      if (!Logger.instance) {
        Logger.instance = new Logger(logLevel);
      }
      return Logger.instance;
    }

    setLogLevel(logLevel: LogLevel) {
      if(logLevel != undefined){
        this.logLevel = logLevel;
      }
    }

    /**
     * this function replaces "console.log" and it will always log the message
     * @param message - The message to log 
     */
    log(...args: any[]): void {
      console.info(...args);
    }

    debug(...args: any[]): void {
      if (this.logLevel <= LogLevel.DEBUG) {
        console.info("[DEBUG]", ...args);
      }
    }
  
    info(...args: any[]): void {
      if (this.logLevel <= LogLevel.INFO) {
        console.info("[INFO]", ...args);
      }
    }
  
    warn(...args: any[]): void {
      if (this.logLevel <= LogLevel.WARNING) {
        console.warn("[WARNING]", ...args);
      }
    }
  
    error(...args: any[]): void {
      if (this.logLevel <= LogLevel.ERROR) {
        console.error("[ERROR]", ...args);
      }
    }
  }