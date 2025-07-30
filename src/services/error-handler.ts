import { promises as fs } from 'node:fs';
import { homedir } from 'node:os';
import { join } from 'node:path';
import { CCNotifyError, ErrorSeverity, ErrorType, ExitCode } from '../types/index.js';

/**
 * Debug levels for logging
 */
export enum DebugLevel {
  NONE = 0,
  ERROR = 1,
  WARN = 2,
  INFO = 3,
  DEBUG = 4,
  VERBOSE = 5,
}

/**
 * Error handler configuration
 */
export interface ErrorHandlerConfig {
  debugLevel: DebugLevel;
  logToFile: boolean;
  logFilePath?: string;
  showStackTrace: boolean;
  colorOutput: boolean;
}

/**
 * Log entry structure
 */
export interface LogEntry {
  timestamp: string;
  level: string;
  message: string;
  error?: any;
  context?: Record<string, any>;
}

/**
 * Comprehensive error handler service
 */
export class ErrorHandler {
  private config: ErrorHandlerConfig;
  private logBuffer: LogEntry[] = [];
  private readonly maxLogBuffer = 100;

  constructor(config: Partial<ErrorHandlerConfig> = {}) {
    this.config = {
      debugLevel: this.getDebugLevelFromEnv(),
      logToFile: config.logToFile ?? false,
      logFilePath: config.logFilePath ?? this.getDefaultLogPath(),
      showStackTrace: config.showStackTrace ?? this.shouldShowStackTrace(),
      colorOutput: config.colorOutput ?? this.shouldUseColors(),
      ...config,
    };
  }

  /**
   * Handle CCNotifyError with comprehensive error reporting
   */
  async handleError(error: CCNotifyError, context?: Record<string, any>): Promise<never> {
    // Log the error
    await this.logError(error, context);

    // Display user-friendly error message
    this.displayError(error);

    // Exit with appropriate code
    process.exit(error.exitCode);
  }

  /**
   * Handle unknown errors by wrapping them in CCNotifyError
   */
  async handleUnknownError(error: unknown, context?: Record<string, any>): Promise<never> {
    const ccError = this.wrapUnknownError(error);
    return await this.handleError(ccError, context);
  }

  /**
   * Log error to console and optionally to file
   */
  async logError(error: CCNotifyError, context?: Record<string, any>): Promise<void> {
    const logEntry: LogEntry = {
      timestamp: new Date().toISOString(),
      level: 'ERROR',
      message: error.message,
      error: error.toJSON(),
      context,
    };

    // Add to buffer
    this.addToLogBuffer(logEntry);

    // Log to console if debug level allows
    if (this.config.debugLevel >= DebugLevel.ERROR) {
      this.logToConsole(logEntry);
    }

    // Log to file if enabled
    if (this.config.logToFile) {
      await this.logToFile(logEntry);
    }
  }

  /**
   * Log warning message
   */
  async logWarning(message: string, context?: Record<string, any>): Promise<void> {
    if (this.config.debugLevel < DebugLevel.WARN) return;

    const logEntry: LogEntry = {
      timestamp: new Date().toISOString(),
      level: 'WARN',
      message,
      context,
    };

    this.addToLogBuffer(logEntry);
    this.logToConsole(logEntry);

    if (this.config.logToFile) {
      await this.logToFile(logEntry);
    }
  }

  /**
   * Log info message
   */
  async logInfo(message: string, context?: Record<string, any>): Promise<void> {
    if (this.config.debugLevel < DebugLevel.INFO) return;

    const logEntry: LogEntry = {
      timestamp: new Date().toISOString(),
      level: 'INFO',
      message,
      context,
    };

    this.addToLogBuffer(logEntry);
    this.logToConsole(logEntry);

    if (this.config.logToFile) {
      await this.logToFile(logEntry);
    }
  }

  /**
   * Log debug message
   */
  async logDebug(message: string, context?: Record<string, any>): Promise<void> {
    if (this.config.debugLevel < DebugLevel.DEBUG) return;

    const logEntry: LogEntry = {
      timestamp: new Date().toISOString(),
      level: 'DEBUG',
      message,
      context,
    };

    this.addToLogBuffer(logEntry);
    this.logToConsole(logEntry);

    if (this.config.logToFile) {
      await this.logToFile(logEntry);
    }
  }

  /**
   * Create a CCNotifyError with enhanced context
   */
  createError(
    type: ErrorType,
    message: string,
    originalError?: Error,
    severity: ErrorSeverity = ErrorSeverity.MEDIUM,
    context?: Record<string, any>
  ): CCNotifyError {
    const error = new CCNotifyError(type, message, originalError, severity);

    // Log the error creation for debugging
    if (this.config.debugLevel >= DebugLevel.DEBUG) {
      this.logDebug(`Creating error: ${type}`, { message, context });
    }

    return error;
  }

  /**
   * Wrap file system errors with appropriate CCNotifyError
   */
  wrapFileSystemError(error: unknown, operation: string, path: string): CCNotifyError {
    const nodeError = error as NodeJS.ErrnoException;

    let errorType = ErrorType.FILE_PERMISSION_ERROR;
    let message = `Failed to ${operation}: ${path}`;
    let severity = ErrorSeverity.MEDIUM;

    if (nodeError.code) {
      switch (nodeError.code) {
        case 'ENOENT':
          message = `File or directory not found: ${path}`;
          break;
        case 'EACCES':
        case 'EPERM':
          message = `Permission denied: ${path}`;
          severity = ErrorSeverity.HIGH;
          break;
        case 'ENOTDIR':
          message = `Not a directory: ${path}`;
          errorType = ErrorType.DIRECTORY_ACCESS_ERROR;
          break;
        case 'EISDIR':
          message = `Is a directory (expected file): ${path}`;
          break;
        case 'ENOSPC':
          message = `No space left on device: ${path}`;
          severity = ErrorSeverity.HIGH;
          break;
        case 'EMFILE':
        case 'ENFILE':
          message = `Too many open files`;
          severity = ErrorSeverity.HIGH;
          break;
        default:
          message = `${operation} failed: ${path} (${nodeError.code})`;
      }
    }

    return this.createError(errorType, message, nodeError, severity, {
      operation,
      path,
      code: nodeError.code,
    });
  }

  /**
   * Wrap JSON parsing errors
   */
  wrapJsonError(error: unknown, filePath: string): CCNotifyError {
    const jsonError = error as Error;

    return this.createError(
      ErrorType.JSON_PARSE_ERROR,
      `Invalid JSON in configuration file: ${filePath}`,
      jsonError,
      ErrorSeverity.MEDIUM,
      { filePath, originalMessage: jsonError.message }
    );
  }

  /**
   * Display error to user with formatting
   */
  private displayError(error: CCNotifyError): void {
    const colors = this.config.colorOutput ? this.getColors() : this.getNoColors();

    // Error header
    console.error(`${colors.red}❌ Error${colors.reset}: ${error.getUserFriendlyMessage()}`);

    // Show additional details in debug mode
    if (this.config.debugLevel >= DebugLevel.DEBUG) {
      console.error(`${colors.dim}Error Type: ${error.type}${colors.reset}`);
      console.error(`${colors.dim}Severity: ${error.severity}${colors.reset}`);
      console.error(`${colors.dim}Exit Code: ${error.exitCode}${colors.reset}`);
      console.error(`${colors.dim}Timestamp: ${error.timestamp.toISOString()}${colors.reset}`);
    }

    // Show stack trace if enabled and available
    if (this.config.showStackTrace && error.stack) {
      console.error(`${colors.dim}Stack Trace:${colors.reset}`);
      console.error(error.stack);
    }

    // Show original error if available and in debug mode
    if (this.config.debugLevel >= DebugLevel.DEBUG && error.originalError) {
      console.error(`${colors.dim}Original Error: ${error.originalError.message}${colors.reset}`);
      if (this.config.showStackTrace && error.originalError.stack) {
        console.error(error.originalError.stack);
      }
    }
  }

  /**
   * Wrap unknown errors in CCNotifyError
   */
  private wrapUnknownError(error: unknown): CCNotifyError {
    if (error instanceof CCNotifyError) {
      return error;
    }

    if (error instanceof Error) {
      return this.createError(ErrorType.COMMAND_ERROR, `Unexpected error: ${error.message}`, error, ErrorSeverity.HIGH);
    }

    return this.createError(
      ErrorType.COMMAND_ERROR,
      `Unknown error occurred: ${String(error)}`,
      undefined,
      ErrorSeverity.HIGH
    );
  }

  /**
   * Add log entry to buffer
   */
  private addToLogBuffer(entry: LogEntry): void {
    this.logBuffer.push(entry);
    if (this.logBuffer.length > this.maxLogBuffer) {
      this.logBuffer.shift();
    }
  }

  /**
   * Log to console with formatting
   */
  private logToConsole(entry: LogEntry): void {
    const colors = this.config.colorOutput ? this.getColors() : this.getNoColors();
    const timestamp = new Date(entry.timestamp).toLocaleTimeString();

    let levelColor = colors.reset;
    let levelIcon = '';

    switch (entry.level) {
      case 'ERROR':
        levelColor = colors.red;
        levelIcon = '❌';
        break;
      case 'WARN':
        levelColor = colors.yellow;
        levelIcon = '⚠️';
        break;
      case 'INFO':
        levelColor = colors.blue;
        levelIcon = 'ℹ️';
        break;
      case 'DEBUG':
        levelColor = colors.dim;
        levelIcon = '🐛';
        break;
    }

    const prefix = `${colors.dim}[${timestamp}]${colors.reset} ${levelColor}${levelIcon} ${entry.level}${colors.reset}`;
    console.error(`${prefix}: ${entry.message}`);

    // Show context in verbose mode
    if (this.config.debugLevel >= DebugLevel.VERBOSE && entry.context) {
      console.error(`${colors.dim}Context: ${JSON.stringify(entry.context, null, 2)}${colors.reset}`);
    }
  }

  /**
   * Log to file
   */
  private async logToFile(entry: LogEntry): Promise<void> {
    if (!this.config.logFilePath) return;

    try {
      // Ensure log directory exists
      const logDir = join(this.config.logFilePath, '..');
      await fs.mkdir(logDir, { recursive: true });

      const logLine = JSON.stringify(entry) + '\n';
      await fs.appendFile(this.config.logFilePath, logLine, 'utf8');
    } catch (error) {
      // Avoid infinite recursion by not using error handler here
      console.error('Failed to write to log file:', error);
    }
  }

  /**
   * Get debug level from environment
   */
  private getDebugLevelFromEnv(): DebugLevel {
    const envLevel = process.env.CCNOTIFY_DEBUG || process.env.DEBUG;
    if (!envLevel) return DebugLevel.ERROR;

    switch (envLevel.toLowerCase()) {
      case 'verbose':
      case '5':
        return DebugLevel.VERBOSE;
      case 'debug':
      case '4':
        return DebugLevel.DEBUG;
      case 'info':
      case '3':
        return DebugLevel.INFO;
      case 'warn':
      case '2':
        return DebugLevel.WARN;
      case 'error':
      case '1':
        return DebugLevel.ERROR;
      case 'none':
      case '0':
        return DebugLevel.NONE;
      default:
        return DebugLevel.ERROR;
    }
  }

  /**
   * Get default log file path
   */
  private getDefaultLogPath(): string {
    const xdgDataHome = process.env.XDG_DATA_HOME || join(homedir(), '.local', 'share');
    return join(xdgDataHome, 'ccnotify', 'error.log');
  }

  /**
   * Determine if stack traces should be shown
   */
  private shouldShowStackTrace(): boolean {
    return (
      process.env.CCNOTIFY_STACK_TRACE === 'true' ||
      process.env.NODE_ENV === 'development' ||
      this.getDebugLevelFromEnv() >= DebugLevel.DEBUG
    );
  }

  /**
   * Determine if colors should be used
   */
  private shouldUseColors(): boolean {
    return process.env.FORCE_COLOR !== '0' && process.env.NO_COLOR === undefined && process.stdout.isTTY;
  }

  /**
   * Get color codes
   */
  private getColors() {
    return {
      red: '\x1b[31m',
      yellow: '\x1b[33m',
      blue: '\x1b[34m',
      dim: '\x1b[2m',
      reset: '\x1b[0m',
    };
  }

  /**
   * Get no-color codes
   */
  private getNoColors() {
    return {
      red: '',
      yellow: '',
      blue: '',
      dim: '',
      reset: '',
    };
  }

  /**
   * Get current log buffer (for testing)
   */
  getLogBuffer(): LogEntry[] {
    return [...this.logBuffer];
  }

  /**
   * Clear log buffer (for testing)
   */
  clearLogBuffer(): void {
    this.logBuffer = [];
  }

  /**
   * Flush logs to file
   */
  async flushLogs(): Promise<void> {
    if (!this.config.logToFile || !this.config.logFilePath) return;

    try {
      // Ensure log directory exists
      const logDir = join(this.config.logFilePath, '..');
      await fs.mkdir(logDir, { recursive: true });

      // Write all buffered logs
      const logLines = this.logBuffer.map(entry => JSON.stringify(entry)).join('\n') + '\n';
      await fs.appendFile(this.config.logFilePath, logLines, 'utf8');

      this.clearLogBuffer();
    } catch (error) {
      console.error('Failed to flush logs to file:', error);
    }
  }
}

/**
 * Default error handler instance
 */
export const errorHandler = new ErrorHandler();

/**
 * Convenience function to handle errors
 */
export async function handleError(error: unknown, context?: Record<string, any>): Promise<never> {
  if (error instanceof CCNotifyError) {
    return await errorHandler.handleError(error, context);
  } else {
    return await errorHandler.handleUnknownError(error, context);
  }
}

/**
 * Convenience function to create errors
 */
export function createError(
  type: ErrorType,
  message: string,
  originalError?: Error,
  severity: ErrorSeverity = ErrorSeverity.MEDIUM
): CCNotifyError {
  return errorHandler.createError(type, message, originalError, severity);
}
