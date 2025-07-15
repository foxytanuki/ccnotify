// TypeScript type definitions for ccnotify

/**
 * Claude configuration structure
 */
export interface ClaudeConfig {
  hooks?: {
    Stop?: StopHook[];
    [key: string]: any;
  };
  [key: string]: any;
}

/**
 * Stop hook configuration
 */
export interface StopHook {
  matcher: string;
  hooks: Hook[];
}

/**
 * Individual hook definition
 */
export interface Hook {
  type: 'command';
  command: string;
}

/**
 * Command options for CLI commands
 */
export interface CommandOptions {
  global?: boolean;
}

/**
 * Discord command arguments
 */
export interface DiscordCommandArgs {
  webhookUrl: string;
  options: CommandOptions;
}

/**
 * ntfy command arguments
 */
export interface NtfyCommandArgs {
  topicName: string;
  options: CommandOptions;
}

/**
 * Error types for the application
 */
export enum ErrorType {
  INVALID_WEBHOOK_URL = 'INVALID_WEBHOOK_URL',
  INVALID_TOPIC_NAME = 'INVALID_TOPIC_NAME',
  FILE_PERMISSION_ERROR = 'FILE_PERMISSION_ERROR',
  JSON_PARSE_ERROR = 'JSON_PARSE_ERROR',
  CONFIG_BACKUP_ERROR = 'CONFIG_BACKUP_ERROR',
  DIRECTORY_ACCESS_ERROR = 'DIRECTORY_ACCESS_ERROR',
  SCRIPT_CREATION_ERROR = 'SCRIPT_CREATION_ERROR',
  VALIDATION_ERROR = 'VALIDATION_ERROR',
  NETWORK_ERROR = 'NETWORK_ERROR',
  COMMAND_ERROR = 'COMMAND_ERROR',
}

/**
 * Exit codes for different error scenarios
 */
export enum ExitCode {
  SUCCESS = 0,
  GENERAL_ERROR = 1,
  INVALID_INPUT = 2,
  FILE_PERMISSION_ERROR = 3,
  JSON_PARSE_ERROR = 4,
  CONFIG_BACKUP_ERROR = 5,
  DIRECTORY_ACCESS_ERROR = 6,
  SCRIPT_CREATION_ERROR = 7,
  VALIDATION_ERROR = 8,
  NETWORK_ERROR = 9,
  COMMAND_ERROR = 10,
}

/**
 * Error severity levels
 */
export enum ErrorSeverity {
  LOW = 'low',
  MEDIUM = 'medium',
  HIGH = 'high',
  CRITICAL = 'critical',
}

/**
 * Custom error class for ccnotify application
 */
export class CCNotifyError extends Error {
  public readonly timestamp: Date;
  public readonly severity: ErrorSeverity;
  public readonly exitCode: ExitCode;

  constructor(
    public type: ErrorType,
    message: string,
    public originalError?: Error,
    severity: ErrorSeverity = ErrorSeverity.MEDIUM,
  ) {
    super(message);
    this.name = 'CCNotifyError';
    this.timestamp = new Date();
    this.severity = severity;
    this.exitCode = this.getExitCodeForType(type);

    // Maintain proper stack trace
    if (Error.captureStackTrace) {
      Error.captureStackTrace(this, CCNotifyError);
    }
  }

  /**
   * Get appropriate exit code for error type
   */
  private getExitCodeForType(errorType: ErrorType): ExitCode {
    switch (errorType) {
      case ErrorType.INVALID_WEBHOOK_URL:
      case ErrorType.INVALID_TOPIC_NAME:
      case ErrorType.VALIDATION_ERROR:
        return ExitCode.INVALID_INPUT;
      case ErrorType.FILE_PERMISSION_ERROR:
        return ExitCode.FILE_PERMISSION_ERROR;
      case ErrorType.JSON_PARSE_ERROR:
        return ExitCode.JSON_PARSE_ERROR;
      case ErrorType.CONFIG_BACKUP_ERROR:
        return ExitCode.CONFIG_BACKUP_ERROR;
      case ErrorType.DIRECTORY_ACCESS_ERROR:
        return ExitCode.DIRECTORY_ACCESS_ERROR;
      case ErrorType.SCRIPT_CREATION_ERROR:
        return ExitCode.SCRIPT_CREATION_ERROR;
      case ErrorType.NETWORK_ERROR:
        return ExitCode.NETWORK_ERROR;
      case ErrorType.COMMAND_ERROR:
        return ExitCode.COMMAND_ERROR;
      default:
        return ExitCode.GENERAL_ERROR;
    }
  }

  /**
   * Get user-friendly error message
   */
  getUserFriendlyMessage(): string {
    const baseMessage = this.message;
    const suggestions = this.getSuggestions();
    
    if (suggestions.length > 0) {
      return `${baseMessage}\n\nSuggestions:\n${suggestions.map(s => `  • ${s}`).join('\n')}`;
    }
    
    return baseMessage;
  }

  /**
   * Get suggestions for resolving the error
   */
  private getSuggestions(): string[] {
    switch (this.type) {
      case ErrorType.INVALID_WEBHOOK_URL:
        return [
          'Ensure the URL starts with https://discord.com/api/webhooks/',
          'Check that the webhook ID and token are correct',
          'Verify the webhook exists and is active in Discord',
        ];
      case ErrorType.INVALID_TOPIC_NAME:
        return [
          'Use only letters, numbers, hyphens, and underscores',
          'Keep the topic name between 1-64 characters',
          'Avoid starting or ending with hyphens or underscores',
        ];
      case ErrorType.FILE_PERMISSION_ERROR:
        return [
          'Check file and directory permissions',
          'Ensure you have write access to the target directory',
          'Try running with appropriate permissions or as administrator',
        ];
      case ErrorType.JSON_PARSE_ERROR:
        return [
          'Check if the configuration file has valid JSON syntax',
          'Consider backing up and recreating the configuration file',
          'Verify the file is not corrupted or empty',
        ];
      case ErrorType.DIRECTORY_ACCESS_ERROR:
        return [
          'Ensure the directory exists and is accessible',
          'Check directory permissions',
          'Verify the path is correct and not a file',
        ];
      default:
        return [];
    }
  }

  /**
   * Convert error to JSON for logging
   */
  toJSON(): Record<string, any> {
    return {
      name: this.name,
      type: this.type,
      message: this.message,
      severity: this.severity,
      exitCode: this.exitCode,
      timestamp: this.timestamp.toISOString(),
      stack: this.stack,
      originalError: this.originalError ? {
        name: this.originalError.name,
        message: this.originalError.message,
        stack: this.originalError.stack,
      } : undefined,
    };
  }
}
